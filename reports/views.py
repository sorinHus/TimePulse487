from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from attendance.models import Attendance
from leaves.models import LeaveRequest
from attendance.serializers import AttendanceSerializer
from leaves.serializers import LeaveRequestSerializer
import calendar

User = get_user_model()


class TeamCalendarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        user = request.user

        # Determina ce useri sa afiseze
        if user.role == 'admin':
            users = User.objects.filter(is_active=True).exclude(is_superuser=True)
        elif user.role == 'manager':
            users = User.objects.filter(is_active=True, manager=user)
        else:
            users = User.objects.filter(id=user.id)

        # Zile din luna
        num_days = calendar.monthrange(year, month)[1]

        result = []
        for u in users:
            # Pontaj
            attendances = Attendance.objects.filter(
                user=u, date__year=year, date__month=month
            )
            attendance_map = {a.date.day: a for a in attendances}

            # Concedii aprobate
            leaves = LeaveRequest.objects.filter(
                user=u,
                status='approved',
                start_date__year__lte=year,
                end_date__year__gte=year,
                start_date__month__lte=month,
                end_date__month__gte=month,
            )

            leave_days = {}
            for leave in leaves:
                from datetime import date, timedelta
                current = leave.start_date
                while current <= leave.end_date:
                    if current.year == year and current.month == month:
                        leave_days[current.day] = {
                            'leave_type': leave.leave_type.name,
                            'color': leave.leave_type.color,
                        }
                    current += timedelta(days=1)

            days = []
            for day in range(1, num_days + 1):
                from datetime import date
                d = date(year, month, day)
                weekday = d.weekday()
                is_weekend = weekday >= 5

                day_data = {
                    'day': day,
                    'weekday': weekday,
                    'is_weekend': is_weekend,
                    'status': None,
                    'check_in': None,
                    'check_out': None,
                    'work_hours': None,
                    'leave_type': None,
                    'color': None,
                }

                if day in leave_days:
                    day_data['status'] = 'leave'
                    day_data['leave_type'] = leave_days[day]['leave_type']
                    day_data['color'] = leave_days[day]['color']
                elif day in attendance_map:
                    a = attendance_map[day]
                    day_data['status'] = a.status
                    day_data['check_in'] = str(a.check_in) if a.check_in else None
                    day_data['check_out'] = str(a.check_out) if a.check_out else None
                    day_data['work_hours'] = str(a.work_hours) if a.work_hours else None
                    day_data['color'] = '#22C55E'
                elif not is_weekend and d <= timezone.localdate():
                    day_data['status'] = 'absent'
                    day_data['color'] = '#EF4444'

                days.append(day_data)

            result.append({
                'user_id': u.id,
                'username': u.username,
                'full_name': u.get_full_name() or u.username,
                'days': days,
            })

        return Response({
            'year': year,
            'month': month,
            'num_days': num_days,
            'users': result,
        })