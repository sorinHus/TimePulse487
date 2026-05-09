import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from accounts.models import User, Department

# --- Departamente ---
departments_data = [
    'Resurse Umane',
    'IT & Tehnologie',
    'Financiar-Contabil',
    'Juridic',
    'Administrativ',
]

departments = {}
for name in departments_data:
    dept, _ = Department.objects.get_or_create(name=name)
    departments[name] = dept
    print(f'Department: {name}')

# --- Director general ---
if not User.objects.filter(username='director.general').exists():
    director = User.objects.create_user(
        username='director.general',
        password='Director2026!',
        first_name='Alexandru',
        last_name='Ionescu',
        email='director@timepulse.app',
        role='manager',
        position='Director General',
        hire_date=date(2015, 1, 10),
    )
    print('Created: director.general')
else:
    director = User.objects.get(username='director.general')
    print('Exists: director.general')

# --- Manageri si angajati per departament ---
dept_data = {
    'Resurse Umane': {
        'manager': ('maria.pop', 'Maria', 'Pop', 'Manager HR'),
        'employees': [
            ('ana.muresan', 'Ana', 'Mureșan', 'Specialist HR'),
            ('ion.crisan', 'Ion', 'Crișan', 'Recrutor'),
            ('elena.stan', 'Elena', 'Stan', 'Specialist Salarizare'),
            ('mihai.dobre', 'Mihai', 'Dobre', 'Specialist Training'),
            ('laura.popa', 'Laura', 'Popa', 'Administrator HR'),
            ('dan.moldovan', 'Dan', 'Moldovan', 'Specialist Pontaj'),
            ('ioana.rus', 'Ioana', 'Rus', 'Recrutor Senior'),
            ('andrei.nitu', 'Andrei', 'Nițu', 'Specialist Beneficii'),
            ('raluca.gheorghe', 'Raluca', 'Gheorghe', 'Asistent HR'),
            ('bogdan.stoica', 'Bogdan', 'Stoica', 'Specialist Evaluare'),
        ]
    },
    'IT & Tehnologie': {
        'manager': ('cristian.micu', 'Cristian', 'Micu', 'Manager IT'),
        'employees': [
            ('sorin.lazar', 'Sorin', 'Lazăr', 'Dezvoltator Backend'),
            ('diana.oprea', 'Diana', 'Oprea', 'Dezvoltator Frontend'),
            ('gabriel.tanase', 'Gabriel', 'Tănase', 'DevOps Engineer'),
            ('roxana.marin', 'Roxana', 'Marin', 'QA Engineer'),
            ('vlad.constantin', 'Vlad', 'Constantin', 'Arhitect Software'),
            ('simona.florescu', 'Simona', 'Florescu', 'Analist de Sistem'),
            ('razvan.ene', 'Răzvan', 'Ene', 'Specialist Securitate'),
            ('catalina.ion', 'Cătălina', 'Ion', 'Dezvoltator Mobile'),
            ('stefan.badea', 'Ștefan', 'Badea', 'Administrator Baze de Date'),
            ('monica.dumitrescu', 'Monica', 'Dumitrescu', 'Specialist IT Support'),
        ]
    },
    'Financiar-Contabil': {
        'manager': ('adriana.voicu', 'Adriana', 'Voicu', 'Manager Financiar'),
        'employees': [
            ('george.petre', 'George', 'Petre', 'Contabil Senior'),
            ('lidia.matei', 'Lidia', 'Matei', 'Analist Financiar'),
            ('florin.dumitru', 'Florin', 'Dumitru', 'Contabil'),
            ('carmen.ionescu', 'Carmen', 'Ionescu', 'Specialist Buget'),
            ('tudor.alexandrescu', 'Tudor', 'Alexandrescu', 'Controlor Financiar'),
            ('irina.costea', 'Irina', 'Costea', 'Casier'),
            ('marius.serban', 'Marius', 'Șerban', 'Specialist Taxe'),
            ('alina.dinu', 'Alina', 'Dinu', 'Contabil Junior'),
            ('cosmin.preda', 'Cosmin', 'Preda', 'Analist Risc'),
            ('valentina.rusu', 'Valentina', 'Rusu', 'Specialist Facturare'),
        ]
    },
    'Juridic': {
        'manager': ('radu.popescu', 'Radu', 'Popescu', 'Manager Juridic'),
        'employees': [
            ('anca.stefan', 'Anca', 'Ștefan', 'Consilier Juridic Senior'),
            ('liviu.constantin', 'Liviu', 'Constantin', 'Consilier Juridic'),
            ('oana.mihai', 'Oana', 'Mihai', 'Specialist Contracte'),
            ('paul.georgescu', 'Paul', 'Georgescu', 'Jurist'),
            ('mirela.nistor', 'Mirela', 'Nistor', 'Specialist Conformitate'),
            ('alex.tudor', 'Alex', 'Tudor', 'Asistent Juridic'),
            ('dana.ionescu', 'Dana', 'Ionescu', 'Specialist GDPR'),
            ('lucian.popa', 'Lucian', 'Popa', 'Jurist Senior'),
            ('teodora.stan', 'Teodora', 'Stan', 'Specialist Litigii'),
            ('victor.marin', 'Victor', 'Marin', 'Asistent Juridic Junior'),
        ]
    },
    'Administrativ': {
        'manager': ('nicoleta.barbu', 'Nicoleta', 'Barbu', 'Manager Administrativ'),
        'employees': [
            ('gheorghe.dima', 'Gheorghe', 'Dima', 'Administrator Clădiri'),
            ('elvira.coman', 'Elvira', 'Coman', 'Specialist Achiziții'),
            ('sorin.nastase', 'Sorin', 'Năstase', 'Responsabil Logistică'),
            ('viorica.gheorghiu', 'Viorica', 'Gheorghiu', 'Secretar'),
            ('nicu.pavel', 'Nicu', 'Pavel', 'Responsabil Arhivă'),
            ('rodica.chivu', 'Rodica', 'Chivu', 'Specialist Protocoale'),
            ('traian.lungu', 'Traian', 'Lungu', 'Administrator Parc Auto'),
            ('cristina.olteanu', 'Cristina', 'Olteanu', 'Asistent Administrativ'),
            ('ionut.zamfir', 'Ionuț', 'Zamfir', 'Curier Intern'),
            ('sabina.enache', 'Sabina', 'Enache', 'Specialist Facilities'),
        ]
    },
}

hire_dates = [
    date(2018, 3, 1), date(2019, 6, 15), date(2020, 1, 10),
    date(2021, 4, 20), date(2022, 9, 5), date(2023, 2, 28),
    date(2023, 7, 1), date(2024, 1, 15), date(2024, 5, 10),
    date(2024, 11, 3),
]

for dept_name, data in dept_data.items():
    dept = departments[dept_name]

    # Manager
    mgr_username, mgr_first, mgr_last, mgr_position = data['manager']
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
            hire_date=date(2017, 1, 1),
            manager=director,
        )
        print(f'Created manager: {mgr_username}')
    else:
        manager = User.objects.get(username=mgr_username)
        print(f'Exists manager: {mgr_username}')

    # Angajati
    for i, (username, first, last, position) in enumerate(data['employees']):
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
                hire_date=hire_dates[i],
                manager=manager,
            )
            print(f'  Created employee: {username}')
        else:
            print(f'  Exists employee: {username}')

print('\n✅ Seed complet!')
print(f'   Director: director.general / Director2026!')
print(f'   Manageri: [username] / Manager2026!')
print(f'   Angajati: [username] / Angajat2026!')