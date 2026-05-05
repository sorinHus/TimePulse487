from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.http import HttpResponse
from attendance.models import Attendance
from leaves.models import LeaveRequest
import calendar
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

User = get_user_model()


class TeamCalendarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))

        user = request.user

        if user.role == 'admin':
            users = User.objects.filter(is_active=True).exclude(is_superuser=True)
        elif user.role == 'manager':
            users = User.objects.filter(is_active=True, manager=user)
        else:
            users = User.objects.filter(id=user.id)

        num_days = calendar.monthrange(year, month)[1]

        result = []
        for u in users:
            attendances = Attendance.objects.filter(
                user=u, date__year=year, date__month=month
            )
            attendance_map = {a.date.day: a for a in attendances}

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


class AttendanceExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))
        user_id = request.query_params.get('user_id')

        user = request.user

        if user_id and user.role in ['admin', 'manager']:
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found.'}, status=404)
        else:
            target_user = user

        attendances = Attendance.objects.filter(
            user=target_user,
            date__year=year,
            date__month=month
        ).order_by('date')

        # Creează workbook
        wb = openpyxl.Workbook()
        ws = wb.active
        month_name = calendar.month_name[month]
        ws.title = f'{month_name} {year}'

        # Stiluri
        header_font = Font(bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='1E40AF', end_color='1E40AF', fill_type='solid')
        center = Alignment(horizontal='center', vertical='center')
        thin = Side(style='thin', color='D1D5DB')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        present_fill = PatternFill(start_color='D1FAE5', end_color='D1FAE5', fill_type='solid')
        absent_fill = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')
        weekend_fill = PatternFill(start_color='F3F4F6', end_color='F3F4F6', fill_type='solid')

        # Titlu
        ws.merge_cells('A1:F1')
        title_cell = ws['A1']
        title_cell.value = f'Attendance Report — {target_user.get_full_name() or target_user.username} — {month_name} {year}'
        title_cell.font = Font(bold=True, size=13)
        title_cell.alignment = center
        ws.row_dimensions[1].height = 30

        # Header
        headers = ['Date', 'Day', 'Check In', 'Check Out', 'Work Hours', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=2, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center
            cell.border = border

        ws.row_dimensions[2].height = 20

        # Date
        num_days = calendar.monthrange(year, month)[1]
        attendance_map = {a.date.day: a for a in attendances}

        from datetime import date
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

        total_hours = 0
        present_days = 0

        for day in range(1, num_days + 1):
            d = date(year, month, day)
            row = day + 2
            is_weekend = d.weekday() >= 5

            if day in attendance_map:
                a = attendance_map[day]
                check_in = str(a.check_in)[:5] if a.check_in else '-'
                check_out = str(a.check_out)[:5] if a.check_out else '-'
                work_hours = float(a.work_hours) if a.work_hours else 0
                status = a.status.capitalize()
                fill = present_fill
                if work_hours:
                    total_hours += work_hours
                    present_days += 1
            else:
                check_in = '-'
                check_out = '-'
                work_hours = '-'
                status = 'Weekend' if is_weekend else 'Absent'
                fill = weekend_fill if is_weekend else absent_fill

            row_data = [
                d.strftime('%d.%m.%Y'),
                day_names[d.weekday()],
                check_in,
                check_out,
                work_hours if work_hours != '-' else '-',
                status,
            ]

            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row, column=col, value=value)
                cell.fill = fill
                cell.alignment = center
                cell.border = border

        # Sumar
        summary_row = num_days + 4
        ws.cell(row=summary_row, column=1, value='Summary').font = Font(bold=True)
        ws.cell(row=summary_row + 1, column=1, value='Present Days:')
        ws.cell(row=summary_row + 1, column=2, value=present_days)
        ws.cell(row=summary_row + 2, column=1, value='Total Hours:')
        ws.cell(row=summary_row + 2, column=2, value=round(total_hours, 2))

        # Latime coloane
        col_widths = [14, 12, 12, 12, 12, 12]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = width

        # Răspuns HTTP
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="attendance_{target_user.username}_{year}_{month:02d}.xlsx"'
        wb.save(response)
        return response