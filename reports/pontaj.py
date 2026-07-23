import calendar
from datetime import date, timedelta

from django.contrib.auth import get_user_model

from attendance.models import AttendanceSession
from leaves.models import LeaveRequest
from .models import PontajEntry, PontajSheet

User = get_user_model()

LEAVE_CODE_MAP = {
    'Annual Leave': 'CO',
    'Sick Leave': 'CM',
    'Unpaid Leave': 'FP',
    'Professional Training Leave': 'AC',
    'Maternity Leave': 'AC',
    'Paternity Leave': 'AC',
    'Parental Leave': 'IC',
    'Child Care Leave': 'IC',
    'Maternal Risk Leave': 'CM',
    'Work Accident Leave': 'CM',
    'Special Events Leave': 'AC',
    'Adoption Leave': 'AC',
    'Carer Leave': 'CI',
    'Family Emergency Leave': 'AC',
}


def pontaj_hours_for(user, session):
    """Ore de pontaj/tichete de masă pentru o zi lucrată.

    Dacă departamentul are un ScheduleType configurat, se folosește valoarea
    fixă a acestuia (indiferent de orele reale). Altfel, comportamentul
    rămâne identic cu cel de dinaintea ScheduleType: orele reale, sau 8 dacă
    lipsesc.
    """
    department = user.department
    if department and department.schedule_type:
        return float(department.schedule_type.pontaj_hours)
    return float(session.work_hours) if session.work_hours else 8.0


def build_day_maps(user, year, month, num_days):
    """Returnează (session_map: {day: AttendanceSession}, leave_day_map: {day: cod})."""
    sessions = AttendanceSession.objects.filter(
        user=user, date__year=year, date__month=month, status='complete'
    )
    session_map = {s.date.day: s for s in sessions}

    leaves = LeaveRequest.objects.filter(
        user=user, status='approved',
        start_date__lte=date(year, month, num_days),
        end_date__gte=date(year, month, 1),
    ).select_related('leave_type')

    leave_day_map = {}
    for leave in leaves:
        current = leave.start_date
        while current <= leave.end_date:
            if current.year == year and current.month == month:
                leave_day_map[current.day] = LEAVE_CODE_MAP.get(leave.leave_type.name, 'AC')
            current += timedelta(days=1)

    return session_map, leave_day_map


def compute_pontaj_cell(user, year, month, day, session_map, leave_day_map):
    """Returnează (hours: float sau None, leave_code: str) pentru o zi.

    Precedență identică cu exportul Excel: weekend → gol; altfel concediu
    aprobat → cod; altfel sesiune completă → ore de pontaj; altfel gol.
    """
    d = date(year, month, day)
    if d.weekday() >= 5:
        return None, ''
    if day in leave_day_map:
        return None, leave_day_map[day]
    if day in session_map:
        return pontaj_hours_for(user, session_map[day]), ''
    return None, ''


def get_or_create_sheet(department, year, month):
    """Ia sheet-ul (departament, an, lună) sau îl creează în stare 'draft',
    populat cu valorile calculate implicit (identice cu exportul Excel)."""
    sheet, created = PontajSheet.objects.get_or_create(
        department=department, year=year, month=month
    )
    if not created:
        return sheet

    num_days = calendar.monthrange(year, month)[1]
    users = User.objects.filter(
        department=department, is_active=True
    ).select_related('department__schedule_type').order_by('last_name', 'first_name')

    entries = []
    for u in users:
        session_map, leave_day_map = build_day_maps(u, year, month, num_days)
        for day in range(1, num_days + 1):
            hours, leave_code = compute_pontaj_cell(u, year, month, day, session_map, leave_day_map)
            entries.append(PontajEntry(
                sheet=sheet, user=u, day=day,
                hours=hours, leave_code=leave_code,
            ))
    PontajEntry.objects.bulk_create(entries)
    return sheet
