import os
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from accounts.models import User
from leaves.models import LeaveType, LeaveBalance, LeaveRequest

# --- Leave Types ---
leave_types_data = [
    {'name': 'Annual Leave', 'max_days_per_year': 21, 'is_paid': True, 'color': '#3B82F6'},
    {'name': 'Sick Leave', 'max_days_per_year': 30, 'is_paid': True, 'color': '#EF4444'},
    {'name': 'Unpaid Leave', 'max_days_per_year': 30, 'is_paid': False, 'color': '#6B7280'},
]

leave_types = {}
for lt_data in leave_types_data:
    lt, _ = LeaveType.objects.get_or_create(
        name=lt_data['name'],
        defaults={
            'max_days_per_year': lt_data['max_days_per_year'],
            'is_paid': lt_data['is_paid'],
            'color': lt_data['color'],
        }
    )
    leave_types[lt.name] = lt
    print(f'LeaveType: {lt.name}')

# --- Toti angajatii (fara admin) ---
employees = User.objects.filter(role__in=['employee', 'manager']).select_related('manager')
print(f'\nAngajati gasiti: {employees.count()}')

# --- Solduri pentru toti ---
current_year = date.today().year
for user in employees:
    for lt in leave_types.values():
        balance, created = LeaveBalance.objects.get_or_create(
            user=user,
            leave_type=lt,
            year=current_year,
            defaults={'total_days': lt.max_days_per_year, 'used_days': 0}
        )
        if created:
            print(f'  Balance: {user.username} / {lt.name} / {lt.max_days_per_year} zile')

print('\nSolduri create.')

# --- Cereri de concediu ---
requests_data = [
    ('ana.muresan', 'Annual Leave', date(2026, 1, 5), date(2026, 1, 16), 'approved', 'Aprobat'),
    ('ion.crisan', 'Sick Leave', date(2026, 2, 3), date(2026, 2, 7), 'approved', 'Aprobat'),
    ('elena.stan', 'Annual Leave', date(2026, 3, 2), date(2026, 3, 13), 'approved', 'Aprobat'),
    ('mihai.dobre', 'Unpaid Leave', date(2026, 1, 19), date(2026, 1, 23), 'rejected', 'Motive insuficiente'),
    ('laura.popa', 'Annual Leave', date(2026, 4, 6), date(2026, 4, 10), 'approved', 'Aprobat'),
    ('dan.moldovan', 'Sick Leave', date(2026, 3, 16), date(2026, 3, 20), 'approved', 'Aprobat'),
    ('ioana.rus', 'Annual Leave', date(2026, 5, 4), date(2026, 5, 15), 'pending', ''),
    ('andrei.nitu', 'Annual Leave', date(2026, 6, 1), date(2026, 6, 12), 'pending', ''),
    ('raluca.gheorghe', 'Sick Leave', date(2026, 2, 17), date(2026, 2, 21), 'approved', 'Aprobat'),
    ('bogdan.stoica', 'Annual Leave', date(2026, 7, 6), date(2026, 7, 17), 'pending', ''),
    ('sorin.lazar', 'Annual Leave', date(2026, 1, 12), date(2026, 1, 23), 'approved', 'Aprobat'),
    ('diana.oprea', 'Sick Leave', date(2026, 4, 13), date(2026, 4, 17), 'approved', 'Aprobat'),
    ('gabriel.tanase', 'Annual Leave', date(2026, 3, 23), date(2026, 4, 3), 'approved', 'Aprobat'),
    ('roxana.marin', 'Unpaid Leave', date(2026, 2, 9), date(2026, 2, 13), 'rejected', 'Nu se aprobă în perioada respectivă'),
    ('vlad.constantin', 'Annual Leave', date(2026, 5, 18), date(2026, 5, 29), 'pending', ''),
    ('simona.florescu', 'Sick Leave', date(2026, 1, 26), date(2026, 1, 30), 'approved', 'Aprobat'),
    ('razvan.ene', 'Annual Leave', date(2026, 6, 15), date(2026, 6, 26), 'pending', ''),
    ('catalina.ion', 'Annual Leave', date(2026, 2, 23), date(2026, 3, 6), 'approved', 'Aprobat'),
    ('stefan.badea', 'Sick Leave', date(2026, 4, 20), date(2026, 4, 24), 'approved', 'Aprobat'),
    ('monica.dumitrescu', 'Annual Leave', date(2026, 7, 20), date(2026, 7, 31), 'pending', ''),
    ('george.petre', 'Annual Leave', date(2026, 1, 5), date(2026, 1, 16), 'approved', 'Aprobat'),
    ('lidia.matei', 'Sick Leave', date(2026, 3, 9), date(2026, 3, 13), 'approved', 'Aprobat'),
    ('florin.dumitru', 'Annual Leave', date(2026, 4, 27), date(2026, 5, 8), 'pending', ''),
    ('carmen.ionescu', 'Unpaid Leave', date(2026, 2, 16), date(2026, 2, 20), 'approved', 'Aprobat'),
    ('tudor.alexandrescu', 'Annual Leave', date(2026, 6, 8), date(2026, 6, 19), 'pending', ''),
    ('irina.costea', 'Sick Leave', date(2026, 1, 19), date(2026, 1, 23), 'approved', 'Aprobat'),
    ('marius.serban', 'Annual Leave', date(2026, 3, 30), date(2026, 4, 10), 'approved', 'Aprobat'),
    ('alina.dinu', 'Annual Leave', date(2026, 5, 11), date(2026, 5, 22), 'pending', ''),
    ('cosmin.preda', 'Sick Leave', date(2026, 2, 2), date(2026, 2, 6), 'approved', 'Aprobat'),
    ('valentina.rusu', 'Annual Leave', date(2026, 7, 13), date(2026, 7, 24), 'pending', ''),
    ('anca.stefan', 'Annual Leave', date(2026, 1, 26), date(2026, 2, 6), 'approved', 'Aprobat'),
    ('liviu.constantin', 'Sick Leave', date(2026, 3, 2), date(2026, 3, 6), 'approved', 'Aprobat'),
    ('oana.mihai', 'Annual Leave', date(2026, 4, 20), date(2026, 5, 1), 'pending', ''),
    ('paul.georgescu', 'Unpaid Leave', date(2026, 2, 23), date(2026, 2, 27), 'rejected', 'Perioadă aglomerată'),
    ('mirela.nistor', 'Annual Leave', date(2026, 6, 22), date(2026, 7, 3), 'pending', ''),
    ('alex.tudor', 'Sick Leave', date(2026, 1, 12), date(2026, 1, 16), 'approved', 'Aprobat'),
    ('dana.ionescu', 'Annual Leave', date(2026, 3, 16), date(2026, 3, 27), 'approved', 'Aprobat'),
    ('lucian.popa', 'Annual Leave', date(2026, 5, 25), date(2026, 6, 5), 'pending', ''),
    ('teodora.stan', 'Sick Leave', date(2026, 4, 6), date(2026, 4, 10), 'approved', 'Aprobat'),
    ('victor.marin', 'Annual Leave', date(2026, 7, 6), date(2026, 7, 17), 'pending', ''),
    ('gheorghe.dima', 'Annual Leave', date(2026, 1, 19), date(2026, 1, 30), 'approved', 'Aprobat'),
    ('elvira.coman', 'Sick Leave', date(2026, 2, 9), date(2026, 2, 13), 'approved', 'Aprobat'),
    ('sorin.nastase', 'Annual Leave', date(2026, 4, 13), date(2026, 4, 24), 'pending', ''),
    ('viorica.gheorghiu', 'Unpaid Leave', date(2026, 3, 23), date(2026, 3, 27), 'approved', 'Aprobat'),
    ('nicu.pavel', 'Annual Leave', date(2026, 6, 1), date(2026, 6, 12), 'pending', ''),
    ('rodica.chivu', 'Sick Leave', date(2026, 1, 26), date(2026, 1, 30), 'approved', 'Aprobat'),
    ('traian.lungu', 'Annual Leave', date(2026, 5, 4), date(2026, 5, 15), 'pending', ''),
    ('cristina.olteanu', 'Annual Leave', date(2026, 3, 9), date(2026, 3, 20), 'approved', 'Aprobat'),
    ('ionut.zamfir', 'Sick Leave', date(2026, 2, 16), date(2026, 2, 20), 'approved', 'Aprobat'),
    ('sabina.enache', 'Annual Leave', date(2026, 7, 20), date(2026, 7, 31), 'pending', ''),
]

print('\nCreez cereri de concediu...')
created_count = 0
for username, lt_name, start, end, status, note in requests_data:
    try:
        user = User.objects.get(username=username)
        lt = leave_types[lt_name]

        if LeaveRequest.objects.filter(user=user, start_date=start, end_date=end).exists():
            print(f'  Exists: {username} {start}→{end}')
            continue

        # Calcul zile lucratoare
        days = 0
        current = start
        while current <= end:
            if current.weekday() < 5:
                days += 1
            current += timedelta(days=1)

        req = LeaveRequest.objects.create(
            user=user,
            leave_type=lt,
            start_date=start,
            end_date=end,
            total_days=days,
            status=status,
            review_note=note if note else '',
            reviewed_by=user.manager if status in ['approved', 'rejected'] else None,
        )

        # Actualizeaza soldul daca e aprobat
        if status == 'approved':
            balance = LeaveBalance.objects.filter(
                user=user, leave_type=lt, year=start.year
            ).first()
            if balance:
                balance.used_days += days
                balance.save()

        created_count += 1
        print(f'  ✅ {username}: {lt_name} {start}→{end} ({status})')

    except User.DoesNotExist:
        print(f'  ❌ User not found: {username}')
    except Exception as e:
        print(f'  ❌ Error {username}: {e}')

print(f'\n✅ Seed leaves complet! {created_count} cereri create.')