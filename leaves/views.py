from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from datetime import date
from .models import LeaveType, LeaveBalance, LeaveRequest
from .serializers import LeaveTypeSerializer, LeaveBalanceSerializer, LeaveRequestSerializer


class LeaveTypeListView(generics.ListAPIView):
    queryset = LeaveType.objects.filter(is_active=True)
    serializer_class = LeaveTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


class LeaveBalanceView(generics.ListAPIView):
    serializer_class = LeaveBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        year = self.request.query_params.get('year', timezone.now().year)
        return LeaveBalance.objects.filter(user=self.request.user, year=year)


class LeaveRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.effective_role == 'admin':
            return LeaveRequest.objects.all().select_related('user', 'leave_type')
        if user.effective_role == 'director':
            return LeaveRequest.objects.filter(
                user__role='manager'
            ).select_related('user', 'leave_type')
        if user.effective_role == 'manager':
            return LeaveRequest.objects.filter(
                user__department=user.department
            ).exclude(user=user).select_related('user', 'leave_type')
        return LeaveRequest.objects.filter(user=user).select_related('leave_type')

    def perform_create(self, serializer):
        from .utils import count_working_days
        instance = serializer.save(user=self.request.user)
        instance.total_days = count_working_days(instance.start_date, instance.end_date)
        instance.save(update_fields=['total_days'])


class LeaveRequestDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.effective_role in ['admin', 'manager']:
            return LeaveRequest.objects.all()
        return LeaveRequest.objects.filter(user=user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            return Response(
                {'detail': 'Only pending requests can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.status = 'cancelled'
        instance.save()
        return Response({'detail': 'Leave request cancelled.'})


class LeaveApproveRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        if request.user.effective_role not in ['admin', 'director', 'manager']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            leave = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != 'pending':
            return Response({'detail': 'Only pending requests can be reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        if action == 'approve':
            leave.status = 'approved'
            # Update leave balance
            balance, _ = LeaveBalance.objects.get_or_create(
                user=leave.user,
                leave_type=leave.leave_type,
                year=leave.start_date.year,
                defaults={'total_days': leave.leave_type.max_days_per_year}
            )
            balance.used_days += leave.total_days
            balance.save()

            # Setare rol temporar pentru înlocuitor
            if leave.substitute:
                substitute = leave.substitute
                substitute.temporary_role = leave.user.effective_role
                substitute.temporary_role_start = leave.start_date
                substitute.temporary_role_end = leave.end_date
                substitute.substituting_for = leave.user
                substitute.save(update_fields=[
                    'temporary_role', 'temporary_role_start',
                    'temporary_role_end', 'substituting_for'
                ])

                # Notificare înlocuitor
                from attendance.models import Notification
                Notification.objects.create(
                    user=substitute,
                    title='Substitute role assigned',
                    message=(
                        f'You will substitute {leave.user.get_full_name()} '
                        f'({leave.user.effective_role}) from {leave.start_date} to {leave.end_date}. '
                        f'You will have {leave.user.effective_role} permissions during this period.'
                    ),
                    type='system'
                )

        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_note = request.data.get('review_note', '')
        leave.save()

        return Response(LeaveRequestSerializer(leave).data)
    
class WorkingDaysPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if not start or not end:
            return Response({'detail': 'start and end required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end)
            from .utils import count_working_days
            days = count_working_days(start_date, end_date)
            return Response({'working_days': days})
        except Exception as e:
            return Response({'detail': str(e), 'type': type(e).__name__}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)