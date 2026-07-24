import os
import sys
import django
from datetime import date, time
from decimal import Decimal

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from accounts.models import User, Department
from attendance.models import ScheduleType

# --- Redenumire departamente generice existente -> structura de hotel ---
# (dacă baza de date a fost deja seed-uită anterior cu departamentele generice,
# le redenumim în loc să lăsăm rânduri vechi orfane / duplicate)
RENAME_MAP = {
    'IT & Tehnologie': 'Recepție',
    'Financiar-Contabil': 'Restaurant & Bar',
    'Juridic': 'Bucătărie',
    'Administrativ': 'Mentenanță',
}
for old_name, new_name in RENAME_MAP.items():
    if not Department.objects.filter(name=new_name).exists():
        updated = Department.objects.filter(name=old_name).update(name=new_name)
        if updated:
            print(f'Redenumit departament: {old_name} -> {new_name}')

# --- Structura de departamente/ture, conform Structura_departamente_hotel_programe.md ---
# 'Resurse Umane' rămâne neschimbat (nu necesită redenumire).
# 'Housekeeping' e departament nou, nu exista in setul generic anterior.
HOTEL_DEPARTMENTS = {
    'Recepție': {
        'schedules': [
            ('Recepție – Tura I (07:00-15:00)', time(7, 0), time(15, 0), 30, Decimal('8.00')),
            ('Recepție – Tura II (15:00-23:00)', time(15, 0), time(23, 0), 30, Decimal('8.00')),
            ('Recepție – Tura III (23:00-07:00)', time(23, 0), time(7, 0), 30, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
    'Housekeeping': {
        'schedules': [
            ('Housekeeping – Program (08:00-17:00)', time(8, 0), time(17, 0), 60, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
    'Restaurant & Bar': {
        'schedules': [
            ('Restaurant & Bar – Tura I (06:30-15:30)', time(6, 30), time(15, 30), 60, Decimal('8.00')),
            ('Restaurant & Bar – Tura II (14:30-23:30)', time(14, 30), time(23, 30), 60, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
    'Bucătărie': {
        'schedules': [
            ('Bucătărie – Tura I (06:00-15:00)', time(6, 0), time(15, 0), 60, Decimal('8.00')),
            ('Bucătărie – Tura II (13:00-22:00)', time(13, 0), time(22, 0), 60, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
    'Mentenanță': {
        'schedules': [
            ('Mentenanță – Program (08:00-17:00)', time(8, 0), time(17, 0), 60, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
    'Resurse Umane': {
        'schedules': [
            ('Resurse Umane – Program (08:00-17:00)', time(8, 0), time(17, 0), 60, Decimal('8.00')),
        ],
        'default_schedule': 0,
    },
}

departments = {}
dept_schedules = {}  # dept_name -> [ScheduleType, ...]

for dept_name, cfg in HOTEL_DEPARTMENTS.items():
    dept, _ = Department.objects.get_or_create(name=dept_name)
    departments[dept_name] = dept
    print(f'Department: {dept_name}')

    schedules = []
    for sched_name, start_t, end_t, break_min, pontaj_h in cfg['schedules']:
        schedule, created = ScheduleType.objects.get_or_create(
            name=sched_name,
            defaults={
                'start_time': start_t,
                'end_time': end_t,
                'break_minutes': break_min,
                'pontaj_hours': pontaj_h,
            }
        )
        schedules.append(schedule)
        print(f'  ScheduleType: {sched_name} ({"created" if created else "exists"})')
    dept_schedules[dept_name] = schedules

    default_schedule = schedules[cfg['default_schedule']]
    if dept.schedule_type_id != default_schedule.id:
        dept.schedule_type = default_schedule
        dept.save(update_fields=['schedule_type'])
        print(f'  Default schedule for {dept_name}: {default_schedule.name}')

# --- Numerotare marca (matricol) ---
next_employee_number = 1

def allocate_employee_number():
    global next_employee_number
    while User.objects.filter(employee_number=f'{next_employee_number:04d}').exists():
        next_employee_number += 1
    number = f'{next_employee_number:04d}'
    next_employee_number += 1
    return number

# --- Director general ---
if not User.objects.filter(username='director.general').exists():
    director = User.objects.create_user(
        username='director.general',
        password='Director2026!',
        first_name='Alexandru',
        last_name='Ionescu',
        email='director@timepulse.app',
        role='director',
        position='Director General',
        employee_number=allocate_employee_number(),
        hire_date=date(2015, 1, 10),
    )
    print('Created: director.general')
else:
    director = User.objects.get(username='director.general')
    director.role = 'director'
    director.save()
    print('Updated: director.general role=director')

hire_dates = [
    date(2018, 3, 1), date(2019, 6, 15), date(2020, 1, 10),
    date(2021, 4, 20), date(2022, 9, 5), date(2023, 2, 28),
    date(2023, 7, 1), date(2024, 1, 15), date(2024, 5, 10),
    date(2024, 11, 3),
]

# --- Manageri si angajati pe ture, per departament ---
# 'shift_index' = None inseamna fara override individual (mosteneste programul
# implicit al departamentului); pentru departamentele cu ture multiple, fiecare
# angajat e alocat explicit pe tura lui.
dept_data = {
    'Recepție': {
        'manager': ('alin.matache', 'Alin', 'Matache', 'Manager Recepție', None),
        'employees': [
            ('ioana.barbu', 'Ioana', 'Barbu', 'Recepționer', 0),
            ('mihai.tudorache', 'Mihai', 'Tudorache', 'Recepționer', 0),
            ('cristina.neagu', 'Cristina', 'Neagu', 'Recepționer', 1),
            ('bogdan.ilie', 'Bogdan', 'Ilie', 'Recepționer', 1),
            ('florin.cocos', 'Florin', 'Cocoș', 'Recepționer (tură de noapte)', 2),
            ('alexandra.puiu', 'Alexandra', 'Puiu', 'Recepționer (tură de noapte)', 2),
        ]
    },
    'Housekeeping': {
        'manager': ('georgeta.marinescu', 'Georgeta', 'Marinescu', 'Guvernantă Șefă', None),
        'employees': [
            ('maria.dobrescu', 'Maria', 'Dobrescu', 'Cameristă', None),
            ('ana.popovici', 'Ana', 'Popovici', 'Cameristă', None),
            ('elena.barbulescu', 'Elena', 'Bărbulescu', 'Cameristă', None),
            ('silvia.gageanu', 'Silvia', 'Găgeanu', 'Cameristă', None),
        ]
    },
    'Restaurant & Bar': {
        'manager': ('robert.szabo', 'Robert', 'Szabo', 'Manager Restaurant & Bar', None),
        'employees': [
            ('daniel.oancea', 'Daniel', 'Oancea', 'Ospătar', 0),
            ('larisa.iftimie', 'Larisa', 'Iftimie', 'Barman', 0),
            ('cosmina.balaban', 'Cosmina', 'Bălăban', 'Ospătar', 1),
            ('vasile.rotaru', 'Vasile', 'Rotaru', 'Barman', 1),
        ]
    },
    'Bucătărie': {
        'manager': ('emil.paduraru', 'Emil', 'Pădureanu', 'Bucătar Șef', None),
        'employees': [
            ('nicolae.zaharia', 'Nicolae', 'Zaharia', 'Bucătar', 0),
            ('ramona.calin', 'Ramona', 'Călin', 'Ajutor Bucătar', 0),
            ('petre.gavrila', 'Petre', 'Gavrilă', 'Bucătar', 1),
            ('simona.trandafir', 'Simona', 'Trandafir', 'Ajutor Bucătar', 1),
        ]
    },
    'Mentenanță': {
        'manager': ('iulian.dobrota', 'Iulian', 'Dobrotă', 'Manager Mentenanță', None),
        'employees': [
            ('costel.bratu', 'Costel', 'Bratu', 'Tehnician Mentenanță', None),
            ('adrian.filip', 'Adrian', 'Filip', 'Tehnician Mentenanță', None),
            ('marian.vlasceanu', 'Marian', 'Vlăsceanu', 'Electrician', None),
        ]
    },
    'Resurse Umane': {
        'manager': ('maria.pop', 'Maria', 'Pop', 'Manager HR', None),
        'employees': [
            ('ana.muresan', 'Ana', 'Mureșan', 'Specialist HR', None),
            ('ion.crisan', 'Ion', 'Crișan', 'Recrutor', None),
            ('elena.stan', 'Elena', 'Stan', 'Specialist Salarizare', None),
        ]
    },
}

for dept_name, data in dept_data.items():
    dept = departments[dept_name]
    schedules = dept_schedules[dept_name]

    # Manager
    mgr_username, mgr_first, mgr_last, mgr_position, mgr_shift = data['manager']
    mgr_schedule = schedules[mgr_shift] if mgr_shift is not None else None
    if not User.objects.filter(username=mgr_username).exists():
        manager = User.objects.create_user(
            username=mgr_username,
            password='Manager2026!',
            first_name=mgr_first,
            last_name=mgr_last,
            email=f'{mgr_username}@timepulse.app',
            role='manager',
            department=dept,
            position=mgr_position,
            schedule_type=mgr_schedule,
            employee_number=allocate_employee_number(),
            hire_date=date(2017, 1, 1),
            manager=director,
        )
        print(f'Created manager: {mgr_username}')
    else:
        manager = User.objects.get(username=mgr_username)
        print(f'Exists manager: {mgr_username}')

    # Angajati, alocati pe tura lor
    for i, (username, first, last, position, shift_index) in enumerate(data['employees']):
        schedule = schedules[shift_index] if shift_index is not None else None
        if not User.objects.filter(username=username).exists():
            User.objects.create_user(
                username=username,
                password='Angajat2026!',
                first_name=first,
                last_name=last,
                email=f'{username}@timepulse.app',
                role='employee',
                department=dept,
                position=position,
                schedule_type=schedule,
                employee_number=allocate_employee_number(),
                hire_date=hire_dates[i % len(hire_dates)],
                manager=manager,
            )
            shift_label = f' -> {schedule.name}' if schedule else ''
            print(f'  Created employee: {username}{shift_label}')
        else:
            print(f'  Exists employee: {username}')

# --- Backfill numar de marca pentru utilizatorii existenti fara el ---
for user in User.objects.filter(employee_number__isnull=True).order_by('id'):
    user.employee_number = allocate_employee_number()
    user.save(update_fields=['employee_number'])
    print(f'Backfilled employee_number for: {user.username} -> {user.employee_number}')

print('\n✅ Seed complet!')
print(f'   Director: director.general / Director2026!')
print(f'   Manageri: [username] / Manager2026!')
print(f'   Angajati: [username] / Angajat2026!')
