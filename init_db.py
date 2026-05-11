import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'sorin487')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'sorin@timepulse.app')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    user = User.objects.get(username=username)
    user.role = 'admin'
    user.save()
    print(f'Superuser {username} created with role=admin.')
else:
    user = User.objects.get(username=username)
    user.set_password(password)
    user.role = 'admin'
    user.is_staff = True
    user.is_superuser = True
    user.save()
    print(f'Updated {username}: password reset, role=admin.')

    # B10: Marchează Sick Leave type
from leaves.models import LeaveType, LeaveBalance
updated = LeaveType.objects.filter(name='Sick Leave').update(is_sick_leave=True, max_days_per_year=365)
LeaveBalance.objects.filter(leave_type__name='Sick Leave').update(total_days=365)
if updated:
    print('Sick Leave type marked with is_sick_leave=True, max_days_per_year=365.')
else:
    print('WARNING: Sick Leave type not found — check seed data.')

# Creare solduri concediu pentru toți userii activi
from leaves.models import LeaveType, LeaveBalance
from django.utils import timezone

current_year = timezone.now().year
all_users = User.objects.filter(is_active=True)
all_types = LeaveType.objects.filter(is_active=True)

created_count = 0
for u in all_users:
    for lt in all_types:
        _, created = LeaveBalance.objects.get_or_create(
            user=u,
            leave_type=lt,
            year=current_year,
            defaults={'total_days': lt.max_days_per_year}
        )
        if created:
            created_count += 1

print(f'Leave balances: {created_count} create pentru {current_year}.')    

# B12: Seed reguli vechime (Codul Muncii RO) — doar dacă nu există
from leaves.models import SeniorityRule
default_rules = [
    {'min_years': 5,  'extra_days': 1},
    {'min_years': 10, 'extra_days': 2},
    {'min_years': 15, 'extra_days': 3},
    {'min_years': 20, 'extra_days': 4},
]
for rule in default_rules:
    SeniorityRule.objects.get_or_create(
        min_years=rule['min_years'],
        defaults={'extra_days': rule['extra_days']}
    )
print('Seniority rules seeded.')