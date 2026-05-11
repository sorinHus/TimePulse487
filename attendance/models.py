from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timedelta


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('half_day', 'Half Day'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendances'
    )
    date = models.DateField(default=timezone.now)
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True)
    work_hours = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance (legacy)'
        verbose_name_plural = 'Attendances (legacy)'
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f'{self.user.username} - {self.date}'


class AttendanceSession(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('complete', 'Complete'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    date = models.DateField(default=timezone.localdate)
    clock_in = models.DateTimeField()
    clock_out = models.DateTimeField(null=True, blank=True)
    work_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    night_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'
        ordering = ['-date', '-clock_in']

    def __str__(self):
        return f'{self.user.username} - {self.date} - session {self.pk}'

    def calculate_hours(self):
        if not self.clock_in or not self.clock_out:
            return

        diff = self.clock_out - self.clock_in
        total_seconds = diff.total_seconds()
        self.work_hours = round(total_seconds / 3600, 2)

        night_seconds = 0
        current = self.clock_in
        while current < self.clock_out:
            next_tick = min(current + timedelta(minutes=1), self.clock_out)
            hour = current.hour
            if hour >= 22 or hour < 6:
                night_seconds += (next_tick - current).total_seconds()
            current = next_tick

        self.night_hours = round(night_seconds / 3600, 2)
        self.status = 'complete'
        self.save(update_fields=['work_hours', 'night_hours', 'status'])