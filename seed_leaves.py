import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'timepulse487.settings')
django.setup()

from leaves.models import LeaveType

leave_types_data = [
    {'name': 'Concediu de odihnă', 'max_days_per_year': 21, 'is_paid': True, 'color': '#3B82F6'},
    {'name': 'Concediu medical', 'max_days_per_year': 30, 'is_paid': True, 'color': '#EF4444'},
    {'name': 'Concediu fără plată', 'max_days_per_year': 30, 'is_paid': False, 'color': '#6B7280'},
    {'name': 'Concediu pentru formare profesională', 'max_days_per_year': 10, 'is_paid': True, 'color': '#8B5CF6'},
    {'name': 'Concediu de maternitate', 'max_days_per_year': 126, 'is_paid': True, 'color': '#EC4899'},
    {'name': 'Concediu paternal', 'max_days_per_year': 15, 'is_paid': True, 'color': '#06B6D4'},
    {'name': 'Concediu pentru creșterea copilului', 'max_days_per_year': 365, 'is_paid': True, 'color': '#F59E0B'},
    {'name': 'Concediu pentru îngrijirea copilului bolnav', 'max_days_per_year': 45, 'is_paid': True, 'color': '#F97316'},
    {'name': 'Concediu de risc maternal', 'max_days_per_year': 120, 'is_paid': True, 'color': '#DB2777'},
    {'name': 'Concediu medical accident de muncă', 'max_days_per_year': 180, 'is_paid': True, 'color': '#DC2626'},
    {'name': 'Concediu pentru evenimente deosebite', 'max_days_per_year': 5, 'is_paid': True, 'color': '#10B981'},
    {'name': 'Concediu de acomodare', 'max_days_per_year': 365, 'is_paid': True, 'color': '#14B8A6'},
    {'name': 'Concediu de îngrijitor', 'max_days_per_year': 5, 'is_paid': False, 'color': '#64748B'},
    {'name': 'Zile libere urgențe familiale', 'max_days_per_year': 10, 'is_paid': False, 'color': '#A855F7'},
]

print('Creez tipuri de concediu...')
for lt_data in leave_types_data:
    lt, created = LeaveType.objects.get_or_create(
        name=lt_data['name'],
        defaults={
            'max_days_per_year': lt_data['max_days_per_year'],
            'is_paid': lt_data['is_paid'],
            'color': lt_data['color'],
        }
    )
    status = 'Created' if created else 'Exists'
    print(f'  {status}: {lt.name} ({lt.max_days_per_year} zile, {"plătit" if lt.is_paid else "neplătit"})')

print(f'\n✅ {LeaveType.objects.count()} tipuri de concediu în bază.')