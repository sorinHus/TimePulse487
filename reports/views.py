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
            user=target_user,
            start_date__year=year
        ).select_related('leave_type').order_by('start_date')

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        styles = getSampleStyleSheet()
        elements = []

        title_style = ParagraphStyle(
            'Title',
            parent=styles['Title'],
            fontSize=16,
            spaceAfter=6,
            textColor=colors.HexColor('#1E40AF'),
        )
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=20,
            textColor=colors.HexColor('#6B7280'),
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
            'pending': colors.HexColor('#FEF3C7'),
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
            'SectionTitle',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1E40AF'),
            spaceBefore=10,
            spaceAfter=8,
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