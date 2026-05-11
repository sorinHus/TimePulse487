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
        import calendar as cal_module
        from datetime import date, timedelta
        from leaves.models import LeaveRequest
        from attendance.models import AttendanceSession

        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))
        dept_id = request.query_params.get('department')

        user = request.user

        if user.effective_role == 'admin':
            users = User.objects.filter(is_active=True)
            if dept_id:
                users = users.filter(department_id=dept_id)
        elif user.effective_role == 'director':
            users = User.objects.filter(is_active=True)
            if dept_id:
                users = users.filter(department_id=dept_id)
        elif user.effective_role == 'manager':
            users = User.objects.filter(is_active=True, department=user.department)
        else:
            users = User.objects.filter(id=user.id)

        num_days = cal_module.monthrange(year, month)[1]
        today = timezone.localdate()

        result = []
        for u in users:
            sessions = AttendanceSession.objects.filter(
                user=u, date__year=year, date__month=month, status='complete',
            )
            attended_days = set(s.date.day for s in sessions)

            leaves = LeaveRequest.objects.filter(
                user=u, status='approved',
            ).filter(
                start_date__lte=date(year, month, num_days),
                end_date__gte=date(year, month, 1),
            ).select_related('leave_type')

            leave_days = {}
            for leave in leaves:
                current = leave.start_date
                while current <= leave.end_date:
                    if current.year == year and current.month == month:
                        leave_days[current.day] = {
                            'leave_type': leave.leave_type.name,
                            'color': leave.leave_type.color,
                        }
                    current += timedelta(days=1)

            for day in range(1, num_days + 1):
                d = date(year, month, day)
                weekday = d.weekday()
                is_weekend = weekday >= 5
                if is_weekend:
                    continue
                status = None
                leave_type = None
                color = None
                if day in leave_days:
                    status = 'leave'
                    leave_type = leave_days[day]['leave_type']
                    color = leave_days[day]['color']
                elif day in attended_days:
                    status = 'present'
                    color = '#22C55E'
                elif d <= today:
                    status = 'absent'
                    color = '#EF4444'
                if status:
                    result.append({
                        'user_id': u.id,
                        'username': u.username,
                        'full_name': u.get_full_name() or u.username,
                        'department_id': u.department_id,
                        'department_name': u.department.name if u.department else None,
                        'date': str(d),
                        'status': status,
                        'leave_type': leave_type,
                        'color': color,
                    })

        return Response(result)


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

        from attendance.models import AttendanceSession
        attendances = AttendanceSession.objects.filter(
            user=target_user, date__year=year, date__month=month, status='complete'
        ).order_by('date')

        wb = openpyxl.Workbook()
        ws = wb.active
        month_name = calendar.month_name[month]
        ws.title = f'{month_name} {year}'

        header_font = Font(bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='1E40AF', end_color='1E40AF', fill_type='solid')
        center = Alignment(horizontal='center', vertical='center')
        thin = Side(style='thin', color='D1D5DB')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)
        present_fill = PatternFill(start_color='D1FAE5', end_color='D1FAE5', fill_type='solid')
        absent_fill = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')
        weekend_fill = PatternFill(start_color='F3F4F6', end_color='F3F4F6', fill_type='solid')

        ws.merge_cells('A1:F1')
        title_cell = ws['A1']
        title_cell.value = f'Attendance Report — {target_user.get_full_name() or target_user.username} — {month_name} {year}'
        title_cell.font = Font(bold=True, size=13)
        title_cell.alignment = center
        ws.row_dimensions[1].height = 30

        headers = ['Date', 'Day', 'Check In', 'Check Out', 'Work Hours', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=2, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center
            cell.border = border
        ws.row_dimensions[2].height = 20

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
                check_in = a.clock_in.strftime('%H:%M') if a.clock_in else '-'
                check_out = a.clock_out.strftime('%H:%M') if a.clock_out else '-'
                work_hours = float(a.work_hours) if a.work_hours else 0
                status = 'Present'
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
                d.strftime('%d.%m.%Y'), day_names[d.weekday()],
                check_in, check_out,
                work_hours if work_hours != '-' else '-', status,
            ]
            for col, value in enumerate(row_data, 1):
                cell = ws.cell(row=row, column=col, value=value)
                cell.fill = fill
                cell.alignment = center
                cell.border = border

        summary_row = num_days + 4
        ws.cell(row=summary_row, column=1, value='Summary').font = Font(bold=True)
        ws.cell(row=summary_row + 1, column=1, value='Present Days:')
        ws.cell(row=summary_row + 1, column=2, value=present_days)
        ws.cell(row=summary_row + 2, column=1, value='Total Hours:')
        ws.cell(row=summary_row + 2, column=2, value=round(total_hours, 2))

        col_widths = [14, 12, 12, 12, 12, 12]
        for i, width in enumerate(col_widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = width

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="attendance_{target_user.username}_{year}_{month:02d}.xlsx"'
        wb.save(response)
        return response


class LeaveExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from io import BytesIO

        year = int(request.query_params.get('year', timezone.now().year))
        user_id = request.query_params.get('user_id')
        user = request.user

        if user_id and user.role in ['admin', 'manager']:
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found.'}, status=404)
        else:
            target_user = user

        leaves = LeaveRequest.objects.filter(
            user=target_user, start_date__year=year
        ).select_related('leave_type').order_by('start_date')

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm
        )

        styles = getSampleStyleSheet()
        elements = []

        title_style = ParagraphStyle(
            'Title', parent=styles['Title'], fontSize=16,
            spaceAfter=6, textColor=colors.HexColor('#1E40AF'),
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'], fontSize=11,
            spaceAfter=20, textColor=colors.HexColor('#6B7280'),
        )

        elements.append(Paragraph('Leave Summary Report', title_style))
        elements.append(Paragraph(
            f'{target_user.get_full_name() or target_user.username} — {year}',
            subtitle_style
        ))

        table_data = [['Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reviewed By']]
        status_colors = {
            'approved': colors.HexColor('#D1FAE5'),
            'rejected': colors.HexColor('#FEE2E2'),
            'pending':  colors.HexColor('#FEF3C7'),
            'cancelled': colors.HexColor('#F3F4F6'),
        }

        row_styles = []
        for i, leave in enumerate(leaves, 1):
            table_data.append([
                leave.leave_type.name,
                leave.start_date.strftime('%d.%m.%Y'),
                leave.end_date.strftime('%d.%m.%Y'),
                str(int(leave.total_days)),
                leave.status.capitalize(),
                leave.reviewed_by.get_full_name() if leave.reviewed_by else '-',
            ])
            bg_color = status_colors.get(leave.status, colors.white)
            row_styles.append(('BACKGROUND', (0, i), (-1, i), bg_color))

        col_widths = [4.5*cm, 3*cm, 3*cm, 2*cm, 2.5*cm, 3.5*cm]
        table = Table(table_data, colWidths=col_widths)
        base_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E40AF')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWHEIGHT', (0, 0), (-1, -1), 22),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ] + row_styles
        table.setStyle(TableStyle(base_style))
        elements.append(table)
        elements.append(Spacer(1, 0.8*cm))

        elements.append(Paragraph('Summary by Leave Type', ParagraphStyle(
            'SectionTitle', parent=styles['Heading2'], fontSize=12,
            textColor=colors.HexColor('#1E40AF'), spaceBefore=10, spaceAfter=8,
        )))

        from leaves.models import LeaveBalance
        balances = LeaveBalance.objects.filter(
            user=target_user, year=year
        ).select_related('leave_type')

        summary_data = [['Leave Type', 'Total Days', 'Used Days', 'Remaining']]
        for balance in balances:
            summary_data.append([
                balance.leave_type.name,
                str(balance.total_days),
                str(int(balance.used_days)),
                str(int(balance.remaining_days)),
            ])

        if len(summary_data) > 1:
            summary_table = Table(summary_data, colWidths=[5*cm, 3*cm, 3*cm, 3*cm])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E40AF')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWHEIGHT', (0, 0), (-1, -1), 22),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ]))
            elements.append(summary_table)

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="leaves_{target_user.username}_{year}.pdf"'
        return response


class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Permission denied.'}, status=403)

        from datetime import date
        today = timezone.localdate()
        current_month = today.month
        current_year = today.year

        total_employees = User.objects.filter(is_active=True, is_superuser=False).count()
        present_today = Attendance.objects.filter(date=today, status='present').count()
        on_leave_today = LeaveRequest.objects.filter(
            status='approved', start_date__lte=today, end_date__gte=today,
        ).count()
        pending_leaves = LeaveRequest.objects.filter(status='pending').count()
        absent_today = total_employees - present_today - on_leave_today

        working_days = 0
        total_present = 0
        from datetime import timedelta
        d = date(current_year, current_month, 1)
        while d <= today:
            if d.weekday() < 5:
                working_days += 1
            d += timedelta(days=1)

        if working_days > 0:
            total_present = Attendance.objects.filter(
                date__year=current_year, date__month=current_month, status='present'
            ).count()
            attendance_rate = round((total_present / (working_days * total_employees)) * 100, 1) if total_employees > 0 else 0
        else:
            attendance_rate = 0

        recent_leaves = LeaveRequest.objects.filter(
            status='pending'
        ).select_related('user', 'leave_type').order_by('-created_at')[:5]

        recent_leaves_data = [{
            'id': leave.id,
            'user': leave.user.get_full_name() or leave.user.username,
            'leave_type': leave.leave_type.name,
            'start_date': leave.start_date,
            'end_date': leave.end_date,
            'total_days': leave.total_days,
            'created_at': leave.created_at,
        } for leave in recent_leaves]

        from accounts.models import Department
        departments = Department.objects.all()
        dept_data = [{
            'name': dept.name,
            'total': User.objects.filter(department=dept, is_active=True, is_superuser=False).count(),
            'present': Attendance.objects.filter(date=today, user__department=dept, status='present').count(),
        } for dept in departments]

        return Response({
            'stats': {
                'total_employees': total_employees,
                'present_today': present_today,
                'on_leave_today': on_leave_today,
                'absent_today': absent_today if absent_today > 0 else 0,
                'pending_leaves': pending_leaves,
                'attendance_rate': attendance_rate,
            },
            'recent_pending_leaves': recent_leaves_data,
            'departments': dept_data,
        })


class ManagerDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['admin', 'manager']:
            return Response({'detail': 'Permission denied.'}, status=403)

        from datetime import date
        today = timezone.localdate()

        team = User.objects.filter(is_active=True, manager=request.user)
        total_team = team.count()

        present_today = Attendance.objects.filter(date=today, status='present', user__in=team).count()
        on_leave_today = LeaveRequest.objects.filter(
            status='approved', start_date__lte=today, end_date__gte=today, user__in=team
        ).count()
        pending_leaves = LeaveRequest.objects.filter(status='pending', user__in=team).count()

        recent_leaves = LeaveRequest.objects.filter(
            status='pending', user__in=team
        ).select_related('user', 'leave_type').order_by('-created_at')[:5]

        recent_leaves_data = [{
            'id': leave.id,
            'user': leave.user.get_full_name() or leave.user.username,
            'leave_type': leave.leave_type.name,
            'start_date': leave.start_date,
            'end_date': leave.end_date,
            'total_days': leave.total_days,
            'created_at': leave.created_at,
        } for leave in recent_leaves]

        team_status = []
        for member in team:
            attendance = Attendance.objects.filter(user=member, date=today).first()
            on_leave = LeaveRequest.objects.filter(
                user=member, status='approved',
                start_date__lte=today, end_date__gte=today,
            ).first()

            if on_leave:
                status_val = 'leave'
                detail = on_leave.leave_type.name
            elif attendance and attendance.check_in:
                status_val = 'present'
                detail = str(attendance.check_in)[:5]
            else:
                status_val = 'absent'
                detail = '-'

            team_status.append({
                'user_id': member.id,
                'full_name': member.get_full_name() or member.username,
                'status': status_val,
                'detail': detail,
            })

        return Response({
            'stats': {
                'total_team': total_team,
                'present_today': present_today,
                'on_leave_today': on_leave_today,
                'absent_today': max(0, total_team - present_today - on_leave_today),
                'pending_leaves': pending_leaves,
            },
            'team_status': team_status,
            'recent_pending_leaves': recent_leaves_data,
        })


class EmployeeDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import date
        today = timezone.localdate()
        current_year = today.year
        current_month = today.month
        user = request.user

        today_attendance = Attendance.objects.filter(user=user, date=today).first()
        attendance_data = None
        if today_attendance:
            attendance_data = {
                'check_in': str(today_attendance.check_in)[:5] if today_attendance.check_in else None,
                'check_out': str(today_attendance.check_out)[:5] if today_attendance.check_out else None,
                'work_hours': str(today_attendance.work_hours) if today_attendance.work_hours else None,
                'status': today_attendance.status,
            }

        from leaves.models import LeaveBalance
        balances = LeaveBalance.objects.filter(user=user, year=current_year).select_related('leave_type')
        balance_data = [{
            'leave_type': b.leave_type.name,
            'color': b.leave_type.color,
            'total_days': b.total_days,
            'used_days': float(b.used_days),
            'remaining_days': float(b.remaining_days),
        } for b in balances]

        recent_requests = LeaveRequest.objects.filter(user=user).select_related('leave_type').order_by('-created_at')[:5]
        requests_data = [{
            'id': req.id,
            'leave_type': req.leave_type.name,
            'color': req.leave_type.color,
            'start_date': req.start_date,
            'end_date': req.end_date,
            'total_days': req.total_days,
            'status': req.status,
        } for req in recent_requests]

        present_this_month = Attendance.objects.filter(
            user=user, date__year=current_year, date__month=current_month, status='present'
        ).count()

        return Response({
            'today_attendance': attendance_data,
            'stats': {'present_this_month': present_this_month},
            'leave_balances': balance_data,
            'recent_requests': requests_data,
        })


class PontajExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from datetime import date, timedelta
        from attendance.models import AttendanceSession
        from leaves.models import LeaveRequest

        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))
        department_id = request.query_params.get('department_id')
        user_id = request.query_params.get('user_id')
        user = request.user

        if user_id:
            if user.effective_role not in ['admin', 'manager', 'director']:
                return Response({'detail': 'Permission denied.'}, status=403)
            users = User.objects.filter(id=user_id, is_active=True)
        elif department_id:
            if user.effective_role not in ['admin', 'manager', 'director']:
                return Response({'detail': 'Permission denied.'}, status=403)
            users = User.objects.filter(
                department_id=department_id, is_active=True
            ).order_by('last_name', 'first_name')
        elif user.effective_role == 'manager':
            users = User.objects.filter(
                department=user.department, is_active=True
            ).order_by('last_name', 'first_name')
        elif user.effective_role in ['admin', 'director']:
            users = User.objects.filter(is_active=True).order_by('last_name', 'first_name')
        else:
            users = User.objects.filter(id=user.id)

        num_days = calendar.monthrange(year, month)[1]
        month_name = calendar.month_name[month]

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

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f'Attendance {month_name} {year}'

        thin = Side(style='thin', color='000000')
        border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
        header_fill   = PatternFill('solid', start_color='D9E1F2', end_color='D9E1F2')
        weekend_fill  = PatternFill('solid', start_color='D9D9D9', end_color='D9D9D9')
        present_fill  = PatternFill('solid', start_color='E2EFDA', end_color='E2EFDA')
        leave_co_fill = PatternFill('solid', start_color='FFF2CC', end_color='FFF2CC')
        leave_cm_fill = PatternFill('solid', start_color='FCE4D6', end_color='FCE4D6')
        leave_other_fill = PatternFill('solid', start_color='EDD9FC', end_color='EDD9FC')

        center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        left   = Alignment(horizontal='left', vertical='center', wrap_text=True)
        bold   = Font(bold=True, size=9, name='Arial')
        normal = Font(size=9, name='Arial')
        small  = Font(size=8, name='Arial')

        # ── Header companie ──────────────────────────────────────────────────
        last_col = get_column_letter(2 + num_days + 8)
        ws.merge_cells(f'A1:{last_col}1')
        ws['A1'] = f'Nexoria Group — Monthly Attendance Sheet — {month_name} {year}'
        ws['A1'].font = Font(bold=True, size=11, name='Arial')
        ws['A1'].alignment = center
        ws['A1'].fill = PatternFill('solid', start_color='1E3A5F', end_color='1E3A5F')
        ws['A1'].font = Font(bold=True, size=11, name='Arial', color='FFFFFF')
        ws.row_dimensions[1].height = 22

        # ── Antet coloane ────────────────────────────────────────────────────
        ws.merge_cells('A2:A3')
        ws['A2'] = 'No.'
        ws['A2'].font = bold
        ws['A2'].alignment = center
        ws['A2'].border = border_all
        ws['A2'].fill = header_fill

        ws.merge_cells('B2:B3')
        ws['B2'] = 'Full Name'
        ws['B2'].font = bold
        ws['B2'].alignment = center
        ws['B2'].border = border_all
        ws['B2'].fill = header_fill

        day_names_en = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
        start_col = 3

        for day in range(1, num_days + 1):
            d = date(year, month, day)
            col = start_col + day - 1

            cell1 = ws.cell(row=2, column=col, value=day)
            cell1.font = bold
            cell1.alignment = center
            cell1.border = border_all

            cell2 = ws.cell(row=3, column=col, value=day_names_en[d.weekday()])
            cell2.font = small
            cell2.alignment = center
            cell2.border = border_all

            if d.weekday() >= 5:
                cell1.fill = weekend_fill
                cell2.fill = weekend_fill
            else:
                cell1.fill = header_fill
                cell2.fill = header_fill

        total_cols = [
            ('Total\nHours', 'T_ORE'),
            ('CO', 'T_CO'),
            ('CM', 'T_CM'),
            ('FP', 'T_FP'),
            ('IC', 'T_IC'),
            ('CI', 'T_CI'),
            ('AC', 'T_AC'),
            ('NE', 'T_NE'),
        ]
        total_start_col = start_col + num_days
        for i, (label, key) in enumerate(total_cols):
            col = total_start_col + i
            ws.merge_cells(start_row=2, start_column=col, end_row=3, end_column=col)
            cell = ws.cell(row=2, column=col, value=label)
            cell.font = bold
            cell.alignment = center
            cell.fill = header_fill
            cell.border = border_all

        # ── Date angajați ─────────────────────────────────────────────────────
        data_start_row = 4
        users_list = list(users)

        for idx, u in enumerate(users_list):
            row = data_start_row + idx

            sessions = AttendanceSession.objects.filter(
                user=u, date__year=year, date__month=month, status='complete'
            )
            session_map = {s.date.day: s for s in sessions}

            leaves = LeaveRequest.objects.filter(
                user=u, status='approved',
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

            cell_nr = ws.cell(row=row, column=1, value=idx + 1)
            cell_nr.font = normal
            cell_nr.alignment = center
            cell_nr.border = border_all

            cell_name = ws.cell(row=row, column=2, value=u.get_full_name() or u.username)
            cell_name.font = normal
            cell_name.alignment = left
            cell_name.border = border_all

            total_ore = 0
            totals = {k: 0 for _, k in total_cols}

            for day in range(1, num_days + 1):
                d = date(year, month, day)
                col = start_col + day - 1
                cell = ws.cell(row=row, column=col)
                cell.font = normal
                cell.alignment = center
                cell.border = border_all

                if d.weekday() >= 5:
                    cell.fill = weekend_fill
                    continue

                if day in leave_day_map:
                    code = leave_day_map[day]
                    cell.value = code
                    if code == 'CO':
                        cell.fill = leave_co_fill
                        totals['T_CO'] += 1
                    elif code == 'CM':
                        cell.fill = leave_cm_fill
                        totals['T_CM'] += 1
                    elif code == 'FP':
                        cell.fill = leave_other_fill
                        totals['T_FP'] += 1
                    elif code == 'IC':
                        cell.fill = leave_other_fill
                        totals['T_IC'] += 1
                    elif code == 'CI':
                        cell.fill = leave_other_fill
                        totals['T_CI'] += 1
                    else:
                        cell.fill = leave_other_fill
                        totals['T_AC'] += 1
                elif day in session_map:
                    s = session_map[day]
                    hours = float(s.work_hours) if s.work_hours else 8
                    cell.value = hours
                    cell.fill = present_fill
                    total_ore += hours

            for i, (label, key) in enumerate(total_cols):
                col = total_start_col + i
                val = total_ore if key == 'T_ORE' else totals[key]
                tc = ws.cell(row=row, column=col, value=round(val, 1) if key == 'T_ORE' else int(val))
                tc.font = bold if val > 0 else normal
                tc.alignment = center
                tc.border = border_all
                tc.fill = header_fill

        # ── Lățimi coloane ────────────────────────────────────────────────────
        ws.column_dimensions['A'].width = 5
        ws.column_dimensions['B'].width = 24
        for day in range(1, num_days + 1):
            ws.column_dimensions[get_column_letter(start_col + day - 1)].width = 3.5
        for i in range(len(total_cols)):
            ws.column_dimensions[get_column_letter(total_start_col + i)].width = 7

        ws.row_dimensions[2].height = 18
        ws.row_dimensions[3].height = 14
        for idx in range(len(users_list)):
            ws.row_dimensions[data_start_row + idx].height = 16

        ws.freeze_panes = 'C4'

        # ── Legendă ───────────────────────────────────────────────────────────
        legend_row = data_start_row + len(users_list) + 2
        legend = [
            ('CO', 'Annual Leave'),
            ('CM', 'Sick Leave'),
            ('FP', 'Unpaid Leave'),
            ('IC', 'Parental / Child Care Leave'),
            ('CI', 'Carer Leave'),
            ('AC', 'Other paid leave'),
            ('NE', 'Unexcused absence'),
        ]
        ws.cell(row=legend_row, column=1, value='Legend:').font = bold
        for i, (code, desc) in enumerate(legend):
            ws.cell(row=legend_row + i + 1, column=1, value=code).font = bold
            ws.cell(row=legend_row + i + 1, column=2, value=desc).font = normal

        # ── Response ──────────────────────────────────────────────────────────
        dept_label = ''
        if department_id:
            from accounts.models import Department
            try:
                dept_label = f'_{Department.objects.get(id=department_id).name.replace(" ", "_")}'
            except:
                pass
        elif user_id and users_list:
            dept_label = f'_{users_list[0].username}'

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        filename = f'attendance_sheet{dept_label}_{year}_{month:02d}.xlsx'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response


class DebugTeamView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        team = User.objects.filter(manager=user)
        return Response({
            'current_user': user.username,
            'current_user_id': user.id,
            'team_count': team.count(),
            'team': list(team.values('username', 'manager_id')),
        })