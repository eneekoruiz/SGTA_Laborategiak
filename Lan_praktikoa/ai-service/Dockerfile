# Python 3.11-slim oinarritutako irudia
FROM python:3.11-slim

# Lan direktorioa ezarri
WORKDIR /app

# requirements.txt lehenengo kopiatu, cache aprobetxatzeko
COPY requirements.txt .

# Python paketeak instalatu (orain azkarrago, konpilatzailerik gabe)
RUN pip install --no-cache-dir -r requirements.txt

# Gainerako kodea kopiatu
COPY . .

# 8000 portua expose (FastAPI/uvicorn)
EXPOSE 8000

# Zerbitzua abiarazi uvicorn bidez
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]