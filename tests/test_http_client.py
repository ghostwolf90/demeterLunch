from __future__ import annotations

import unittest

from src.http_client import RequestRateLimiter


class _FakeTime:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class RequestRateLimiterTests(unittest.TestCase):
    def test_spaces_request_starts_without_adding_delay_after_slow_response(self) -> None:
        fake_time = _FakeTime()
        limiter = RequestRateLimiter(
            1.2,
            clock=fake_time.monotonic,
            sleeper=fake_time.sleep,
        )

        limiter.wait()
        fake_time.now = 0.4
        limiter.wait()
        fake_time.now = 4.0
        limiter.wait()

        self.assertEqual(len(fake_time.sleeps), 1)
        self.assertAlmostEqual(fake_time.sleeps[0], 0.8)
        self.assertEqual(limiter.request_count, 3)


if __name__ == "__main__":
    unittest.main()
