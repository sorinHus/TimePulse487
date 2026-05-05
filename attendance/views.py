from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Attendance
from .serializers import AttendanceSerializer, CheckInSerializer, CheckOutSerializer


class CheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        today = timezone.localdate()
        existing = Attendance.objects.filter(user=request.user, date=today).first()

        if existing and existing.check_in:
            return Response(
                {'detail': 'You have already checked in today.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CheckInSerializer(data=request.data)
        if serializer.is_valid():
            attendance, created = Attendance.objects.get_or_create(
                user=request.user,
                date=today,
                defaults={'notes': serializer.validated_data.get('notes', '')}
            )
            attendance.check_in = timezone.localtime().time()
            attendance.status = 'present'
            attendance.save()
            return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CheckOutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()

        if not attendance or not attendance.check_in:
            return Response(
                {'detail': 'You have not checked in today.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if attendance.check_out:
            return Response(
                {'detail': 'You have already checked out today.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CheckOutSerializer(data=request.data)
        if serializer.is_valid():
            attendance.check_out = timezone.localtime().time()
            if serializer.validated_data.get('notes'):
                attendance.notes = serializer.validated_data['notes']
            attendance.save()
            attendance.calculate_work_hours()
            return Response(AttendanceSerializer(attendance).data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TodayAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(user=request.user, date=today).first()
        if attendance:
            return Response(AttendanceSerializer(attendance).data)
        return Response({'detail': 'No attendance record for today.'}, status=status.HTTP_404_NOT_FOUND)


class AttendanceHistoryView(generics.ListAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.filter(user=user)
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month and year:
            queryset = queryset.filter(date__month=month, date__year=year)
        return queryset


class TeamAttendanceView(generics.ListAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()
        date = self.request.query_params.get('date', today)

        if user.role in ['admin', 'manager']:
            if user.role == 'manager':
                team_ids = user.subordinates.values_list('id', flat=True)
                return Attendance.objects.filter(user_id__in=team_ids, date=date)
            return Attendance.objects.filter(date=date)

        return Attendance.objects.none()