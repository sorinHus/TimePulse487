from django.core.management.base import BaseCommand
from django.utils import timezone
from leaves.models import LeaveRequest, LeaveBalance
from attendance.models import Notification


class Command(BaseCommand):
    help = 'Auto-approve pending leave requests whose start_date has arrived.'

    def handle(self, *args, **options):
        today = timezone.localdate()

        pending = LeaveRequest.objects.filter(
            status='pending',
            start_date__lte=today,
        ).select_related('user', 'leave_type', 'substitute')

        approved_count = 0

        for leave in pending:
            # Aprobă cererea
            leave.status = 'approved'
            leave.reviewed_at = timezone.now()
            leave.review_note = 'Auto-approved: leave start date reached.'
            leave.save(update_fields=['status', 'reviewed_at', 'review_note'])

            # Actualizare sold
            balance, _ = LeaveBalance.objects.get_or_create(
                user=leave.user,
                leave_type=leave.leave_type,
                year=leave.start_date.year,
                defaults={'total_days': leave.leave_type.max_days_per_year}
            )
            balance.used_days += leave.total_days
            balance.save(update_fields=['used_days'])

            # Rol temporar pentru înlocuitor
            if leave.substitute:
                sub = leave.substitute
                sub.temporary_role = leave.user.effective_role
                sub.temporary_role_start = leave.start_date
                sub.temporary_role_end = leave.end_date
                sub.substituting_for = leave.user
                sub.save(update_fields=[
                    'temporary_role', 'temporary_role_start',
                    'temporary_role_end', 'substituting_for'
                ])
                Notification.objects.create(
                    user=sub,
                    title='Substitute role assigned',
                    message=(
                        f'You will substitute {leave.user.get_full_name()} '
                        f'from {leave.start_date} to {leave.end_date}.'
                    ),
                    type='system',
                    code='substitute_assigned',
                    params={
                        'substituted_name': leave.user.get_full_name(),
                        'role': leave.user.effective_role,
                        'start_date': str(leave.start_date),
                        'end_date': str(leave.end_date),
                    },
                )

            # Notificare angajat
            Notification.objects.create(
                user=leave.user,
                title='Leave request auto-approved',
                message=(
                    f'Your {leave.leave_type.name} request '
                    f'({leave.start_date} - {leave.end_date}, {leave.total_days} days) '
                    f'has been automatically approved as the start date has arrived.'
                ),
                type='leave',
                code='leave_auto_approved',
                params={
                    'leave_type': leave.leave_type.name,
                    'start_date': str(leave.start_date),
                    'end_date': str(leave.end_date),
                    'total_days': leave.total_days,
                },
            )

            # Notificare manager
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                manager = User.objects.filter(
                    department=leave.user.department,
                    role='manager',
                    is_active=True,
                ).exclude(pk=leave.user.pk).first()

                if manager:
                    Notification.objects.create(
                        user=manager,
                        title='Leave auto-approved',
                        message=(
                            f'{leave.user.get_full_name()}\'s {leave.leave_type.name} '
                            f'({leave.start_date} - {leave.end_date}) was auto-approved.'
                        ),
                        type='leave',
                        code='leave_auto_approved_manager',
                        params={
                            'employee_name': leave.user.get_full_name(),
                            'leave_type': leave.leave_type.name,
                            'start_date': str(leave.start_date),
                            'end_date': str(leave.end_date),
                        },
                    )
            except Exception:
                pass

            approved_count += 1
            self.stdout.write(f'Auto-approved: {leave.user.username} — {leave.leave_type.name} {leave.start_date}')

        self.stdout.write(self.style.SUCCESS(f'Done. {approved_count} leave(s) auto-approved.'))