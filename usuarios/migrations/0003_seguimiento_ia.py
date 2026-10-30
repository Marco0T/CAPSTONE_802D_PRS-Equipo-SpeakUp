from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("usuarios", "0002_conversacion")]
    operations = [
        migrations.AddField(model_name="conversacion", name="seguimiento_ia", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="conversacion", name="estado_ia", field=models.CharField(max_length=20, default="pendiente")),
    ]
