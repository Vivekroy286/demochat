from django.db import models

# Create your models here.

from django.contrib.auth.models import User

class Room(models.Model):
    name = models.CharField(max_length=100)

class Message(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)