import os
import django
import random
import requests
from datetime import date, datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from django.utils import timezone
from accounts.models import User
from attendance.models import AttendanceSession
from leaves.models import LeaveRequest

random.seed(42)

START_DATE = date(2026, 1, 1)
END_DATE = date(2026, 5, 11)
ERROR_RATE = 0.05


def fetch_public_holidays(year):
    try:
        response = requests.get(f'https://zilelibere.webventure.ro/api/{year}', timeout=10)
        data = response.json()
        holidays = set()
        for holiday in data:
            for d in holiday.get('date', []):
                try:
                    parsed = datetime.strptime(d['date'], '%Y/%m/%d').date()
                    holidays.add(parsed)
                except (ValueError, KeyError):
                    pass
        print(f'Loaded {len(holidays)} public holidays for {year}')
        return holidays
    except Exception as e:
        print(f'Warning: could not fetch public holidays: {e}')
        return set()


def get_working_days(start, end, holidays):
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5 and current not in holidays:
            days.append(current)
        current += timedelta(days=1)
    return days


def get_approved_leave_dates(user):
    leave_dates = set()
    requests_qs = LeaveRequest.objects.filter(
        user=user,
        status='approved',
        start_date__lte=END_DATE,
        end_date__gte=START_DATE,
    )
    for req in requests_qs:
        current = max(req.start_date, START_DATE)
        while current <= min(req.end_date, END_DATE):
            if current.weekday() < 5:
                leave_dates.add(current)
            current += timedelta(days=1)
    return leave_dates


def make_session(user, work_date, is_error=False):
    clock_in_hour = random.randint(7, 9)
    if clock_in_hour == 7:
        clock_in_minute = random.randint(45, 59)
    elif clock_in_hour == 9:
        clock_in_minute = random.randint(0, 15)
    else:
        clock_in_minute = random.randint(0, 59)

    clock_in_naive = datetime(
        work_date.year, work_date.month, work_date.day,
        clock_in_hour, clock_in_minute, random.randint(0, 59)
    )
    clock_in = timezone.make_aware(clock_in_naive)

    if is_error:
        error_type = random.choice(['no_clockout', 'short_session'])
        if error_type == 'no_clockout':
            AttendanceSession.objects.create(
                user=user,
                date=work_date,
                clock_in=clock_in,
                status='open',
            )
            return
        else:
            work_minutes = random.randint(5, 30)
    else:
        work_minutes = random.randint(480, 570)

    clock_out = clock_in + timedelta(minutes=work_minutes)
    session = AttendanceSession(
        user=user,
        date=work_date,
        clock_in=clock_in,
        clock_out=clock_out,
        status='complete',
    )
    session.save()
    session.calculate_hours()


def seed_user(user, working_days):
    leave_dates = get_approved_leave_dates(user)

    existing_dates = set(
        AttendanceSession.objects.filter(
            user=user,
            date__gte=START_DATE,
            date__lte=END_DATE,
        ).values_list('date', flat=True)
    )

    created = 0
    skipped_leave = 0
    skipped_existing = 0

    for work_date in working_days:
        if work_date in leave_dates:
            skipped_leave += 1
            continue
        if work_date in existing_dates:
            skipped_existing += 1
            continue

        is_error = random.random() < ERROR_RATE
        make_session(user, work_date, is_error=is_error)
        created += 1

    return created, skipped_leave, skipped_existing


# --- Main ---
holidays = fetch_public_holidays(2026)
working_days = get_working_days(START_DATE, END_DATE, holidays)

print(f'Working days in period: {len(working_days)}')
print(f'Public holidays skipped: dates like {sorted(holidays)[:5]}...\n')

users = User.objects.filter(
    role__in=['employee', 'manager', 'director']
).exclude(username='sorin487')

print(f'Seeding attendance for {users.count()} users...')
print(f'Period: {START_DATE} to {END_DATE}')
print(f'Error rate: {int(ERROR_RATE * 100)}%\n')

total_created = 0
for user in users:
    created, skipped_leave, skipped_existing = seed_user(user, working_days)
    total_created += created
    print(f'  {user.username}: {created} sessions, {skipped_leave} leave days, {skipped_existing} existing')

print(f'\n✅ Done! Total sessions created: {total_created}')