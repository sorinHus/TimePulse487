from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
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
        if user.role in ['admin', 'manager']:
            return LeaveRequest.objects.all().select_related('user', 'leave_type')
        return LeaveRequest.objects.filter(user=user).select_related('leave_type')

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        instance.calculate_days()


class LeaveRequestDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
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
        if request.user.role not in ['admin', 'manager']:
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
        elif action == 'reject':
            leave.status = 'rejected'
        else:
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        leave.reviewed_by = request.user
        leave.reviewed_at = timezone.now()
        leave.review_note = request.data.get('review_note', '')
        leave.save()

        return Response(LeaveRequestSerializer(leave).data)