import struct
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from src.image_downloader import (
    ImageDownloader,
    InvalidImageError,
    classify_menu_image_role,
    inspect_image,
)
from src.models import ImageSource


class ImageInspectionTests(unittest.TestCase):
    def test_png_dimensions(self) -> None:
        data = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + struct.pack(">II", 2000, 1414)
        self.assertEqual(inspect_image(data), ("png", 2000, 1414))

    def test_rejects_html(self) -> None:
        with self.assertRaises(InvalidImageError):
            inspect_image(b"<html>not an image</html>")

    def test_retries_when_blogger_returns_smaller_than_declared(self) -> None:
        low = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + struct.pack(">II", 400, 300)
        high = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8 + struct.pack(">II", 800, 600)

        class FakeHttp:
            def __init__(self) -> None:
                self.calls = 0

            def get(self, *args, **kwargs):
                self.calls += 1
                return SimpleNamespace(
                    data=low if self.calls == 1 else high,
                    content_type="image/png",
                )

        http = FakeHttp()
        source = ImageSource(
            original_url="https://example.test/image.png",
            download_url="https://example.test/image.png",
            declared_width=800,
            declared_height=600,
        )
        with tempfile.TemporaryDirectory() as directory:
            result = ImageDownloader(http).download(source, Path(directory), 1)
        self.assertEqual(http.calls, 2)
        self.assertEqual((result["width"], result["height"]), (800, 600))
        self.assertTrue(result["matchesDeclaredDimensions"])

    def test_classifies_summary_meat_and_vegetarian_images(self) -> None:
        summary = ImageSource("https://example.test/1.png", "https://example.test/1.png")
        meat = ImageSource(
            "https://example.test/%E8%91%B7_page-0001.jpg",
            "https://example.test/M_page-0001.jpg",
        )
        vegetarian = ImageSource(
            "https://example.test/%E7%B4%A0_page-0001.jpg",
            "https://example.test/V_page-0001.jpg",
        )
        self.assertEqual(classify_menu_image_role(summary, 1), "summary")
        self.assertEqual(classify_menu_image_role(meat, 2), "meat_detail")
        self.assertEqual(
            classify_menu_image_role(vegetarian, 3), "vegetarian_detail"
        )


if __name__ == "__main__":
    unittest.main()
