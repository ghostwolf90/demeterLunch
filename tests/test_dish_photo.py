import struct
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from src import dish_photo


class DishPhotoTests(unittest.TestCase):
    def setUp(self):
        dish_photo._cache.clear()

    def tearDown(self):
        dish_photo._cache.clear()

    def test_invalid_ids_do_not_contact_source(self):
        with patch.object(dish_photo._client, "get") as get:
            for value in ("", "../123", "0", "https://example.com", "1" * 21):
                with self.assertRaises(ValueError):
                    dish_photo.load_dish_photo(value)
            get.assert_not_called()

    def test_valid_photo_is_bounded_and_cached(self):
        png = b"\x89PNG\r\n\x1a\n" + b"\0" * 8 + struct.pack(">II", 640, 480)
        with patch.object(dish_photo._client, "get", return_value=SimpleNamespace(data=png)) as get:
            self.assertEqual(dish_photo.load_dish_photo("123"), (png, "image/png"))
            self.assertEqual(dish_photo.load_dish_photo("123"), (png, "image/png"))
            self.assertEqual(get.call_count, 1)
            self.assertEqual(get.call_args.args[0], "https://fatraceschool.k12ea.gov.tw/dish/pic/123")
            self.assertEqual(get.call_args.kwargs["max_bytes"], 5 * 1024 * 1024)

    def test_html_response_is_rejected_and_not_cached(self):
        with patch.object(dish_photo._client, "get", return_value=SimpleNamespace(data=b"<html>error</html>")):
            with self.assertRaises(ValueError):
                dish_photo.load_dish_photo("123")
            self.assertNotIn("123", dish_photo._cache)
