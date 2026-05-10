import requests
from datetime import date, timedelta
from django.core.cache import cache


def get_public_holidays(year: int) -> set:
    """Fetch Romanian public holidays from zilelibere.webventure.ro with caching."""
    cache_key = f'public_holidays_{year}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        response = requests.get(
            f'https://zilelibere.webventure.ro/api/{year}',
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            holidays = set()
            for item in data:
                # date is a list of objects: [{"date": "2026/01/01", "weekday": "Thu"}, ...]
                for day_obj in item.get('date', []):
                    try:
                        raw = day_obj['date'].replace('/', '-')
                        d = date.fromisoformat(raw)
                        holidays.add(d)
                    except (KeyError, ValueError):
                        continue
            cache.set(cache_key, holidays, timeout=86400)  # 24h
            return holidays
    except Exception:
        pass

    return set()


def count_working_days(start_date: date, end_date: date) -> int:
    """Count working days between start and end (inclusive), excluding weekends and Romanian holidays."""
    if start_date > end_date:
        return 0

    years = set(range(start_date.year, end_date.year + 1))
    holidays = set()
    for year in years:
        holidays |= get_public_holidays(year)

    count = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in holidays:
            count += 1
        current += timedelta(days=1)

    return count