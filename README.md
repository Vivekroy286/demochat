# Vchat
Vchat is a real-time video confrencing application built using webrtc and Socket.io, designed for seamless communication between users.
## Description:
This project was made for learning how to signal WebRTC SDPs using Javascript WebSocket and django-channels to make multi-peer video conferencing systems.
## Features
Real-time Messaging: Instantaneous message delivery between users.

User Authentication: Simple username-based authentication for joining chats.

Typing Indicators: Displays when a user is typing a message.

Message History: Persists chat history for current session.

## Demo
View a live demo of vChat [here](https://vchat-990c.onrender.com).


## Installation:
To run Vchat locally, follow these steps:


Run the command: git clone [https://github.com/Vivekroy286/demochat](https://github.com/Vivekroy286/demochat)

Go to the directory with **requirements.txt**.

Run the command: 
```python -m venv venv```

After a venv directory is created, run the command for windows: 
```venv\Scripts\activate```
run the command for Unix or MacOS:
```source venv/bin/activate```

Ensure latest version of pip by running:
```python -m pip install --upgrade pip```

Install the dependencies by running the command: 
```pip install -r requirements.txt```

We need multiple devices in the same LAN for testing. For that we need to make our localhost public. 

## Usage:
From the directory where we have installed venv, go to the mysite directory by running the command: ```cd mysite```

To start the development server, run the command: ```python manage.py runserver```

On local device, go to http://127.0.0.1:8000/ On other devices.

Once the page is loaded, type a username and click join room from each device. Be sure to use different usernames for now.

Type messages in the input box at the bottom and press Enter to send.

Enjoy the seamless communication experience!

## Technologies Used
Backend: python ,django

Frontend: HTML, CSS, JavaScript

Real-time Communication: Socket.io

Data Persistence: sqlite3

## Contributing
Contributions are welcome! If you'd like to contribute to Vchat, fork the repository and submit a pull request. Please follow the code of conduct.

## Roadmap
Implement end-to-end encryption for enhanced security.

Integrate video and voice chat features using WebRTC.

Enhance UI/UX with customizable themes and user profiles.




