# FlowForge — Real-Time Collaborative Kanban

FlowForge is a real-time collaborative Kanban board application built with Java, Spring Boot, MySQL, WebSockets, and vanilla JavaScript.

It allows multiple users to create and manage shared boards, organize tasks across different workflow stages, and see changes from other users in real time without refreshing the page.

## Features

- User registration and login
- Create and manage Kanban boards
- Add existing FlowForge users to shared boards
- Remove members from boards
- Owner-only board management
- Delete boards
- Create, edit, and delete tasks
- Drag-and-drop task management
- To Do, In Progress, and Done workflow
- Task priorities
- Task due dates
- Task dependencies
- Dependency-aware task handling
- Real-time task synchronization using WebSockets
- Real-time board membership updates
- Real-time board deletion updates
- AutoFlow task prioritization engine
- Persistent MySQL storage
- Responsive browser-based interface

## AutoFlow

FlowForge includes an AutoFlow prioritization engine implemented in Java.

The engine evaluates task information such as:

- Priority
- Due date
- Estimated effort
- Task dependencies

Based on these factors, AutoFlow helps identify tasks that require greater attention.

## Real-Time Collaboration

FlowForge uses WebSockets with STOMP and SockJS to provide real-time collaboration.

When a user creates, edits, deletes, or moves a task, the change is synchronized with other connected users viewing the same board without requiring a page refresh.

Board-level changes are also synchronized in real time, including:

- Adding a member
- Removing a member
- Deleting a shared board

## User and Board Management

FlowForge supports collaborative boards where users can work together on the same set of tasks.

The board owner can:

- Create boards
- Add existing FlowForge users
- Remove members
- Delete boards
- Manage tasks

Members can access shared boards and collaborate on tasks in real time.

## Tech Stack

### Backend

- Java 17
- Spring Boot 3.5
- Spring Web
- Spring Security
- Spring Data JPA
- Hibernate
- Maven

### Database

- MySQL

### Real-Time Communication

- WebSocket
- STOMP
- SockJS

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript

## Architecture

'
                    FlowForge
                        │
        ┌───────────────┴───────────────┐
        │                               │
    Frontend                         Backend
 HTML / CSS / JS                  Spring Boot
        │                               │
        │ REST API                      │
        ├──────────────────────────────►│
        │                               │
        │ WebSocket / STOMP             │
        ├──────────────────────────────►│
        │                               │
        │                               ▼
        │                         Spring Services
        │                               │
        │                               ▼
        │                         JPA / Hibernate
        │                               │
        │                               ▼
        └──────────────────────────► MySQL

Project Structure:
FlowForge
│
├── src
│   ├── main
│   │   ├── java
│   │   │   └── com
│   │   │       └── flowforge
│   │   │           ├── config
│   │   │           ├── model
│   │   │           ├── repo
│   │   │           ├── service
│   │   │           └── web
│   │   │
│   │   └── resources
│   │       ├── static
│   │       └── application.properties
│   │
│   └── test
│
├── pom.xml
├── schema.sql
├── .gitignore
└── README.md

Database:
FlowForge uses MySQL for persistent storage.
The application stores information including:
Users
Boards
Board memberships
Tasks
Task relationships and metadata

Running Locally
Prerequisites:
Make sure the following are installed:
Java 17
Maven
MySQL
Git

1. Clone the repository
git clone https://github.com/ShravaniJ77/FlowForge.git

Move into the project directory:
cd FlowForge

2. Create the database
Open MySQL and create the FlowForge database:
CREATE DATABASE flowforge;

3. Configure the database password
The project does not store the MySQL password directly in the source code.
The application reads the password from the DB_PASSWORD environment variable.

Set:
DB_PASSWORD=your_mysql_password

The default database configuration expects:
Database: flowforge
Username: root

If your MySQL username is different, update the username in:
src/main/resources/application.properties

4. Run the application
Using Maven:
mvn spring-boot:run

5. Open FlowForge
Open your browser and visit:
http://localhost:8080

Real-Time WebSocket Flow

FlowForge uses a WebSocket connection to synchronize changes between connected users.

User A
   │
   │ Create / Edit / Move Task
   ▼
Spring Boot Backend
   │
   │ WebSocket Broadcast
   ▼
┌─────────────────────┐
│                     │
▼                     ▼
User A              User B
Browser             Browser
   │                     │
   └─────── Updated ─────┘

This allows collaborators to see task changes without manually refreshing the page.

#REST API
The backend exposes REST endpoints for:
Authentication
Boards
Board members
Tasks
AutoFlow functionality

WebSockets are used alongside the REST API for real-time synchronization.

#Security:
FlowForge uses Spring Security for application authentication and access control.

Database credentials are provided through environment variables rather than being stored directly in the source code.

Board management operations are restricted according to the user's board permissions.

#Future Improvements:
Potential future improvements include:

Pending board invitations
Activity history and audit logs
Productivity analytics dashboard
Advanced task filtering and search
Additional collaboration controls
Production monitoring
Cloud deployment
Screenshots

#Screenshots of the FlowForge interface :

#User Authentication — Sign In
<img width="959" height="440" alt="Screenshot 2026-09-20 200010" src="https://github.com/user-attachments/assets/62f5ba2f-fe09-4bf7-9aad-5dfebb4f6372" />

#Empty Workspace / Dashboard
<img width="484" height="435" alt="Screenshot 2026-09-20 200252" src="https://github.com/user-attachments/assets/2ec79df2-253c-4ae7-b8a4-a136e5fea726" />

#AutoFlow with Prioritized Tasks
<img width="577" height="357" alt="Screenshot 2026-09-20 201205" src="https://github.com/user-attachments/assets/04823b6c-b4bd-40e2-8f62-71fe0ab2e5d0" />

#Kanban Board with Tasks & Dependencies
<img width="569" height="257" alt="Screenshot 2026-09-20 201217" src="https://github.com/user-attachments/assets/2325e2b8-cfa3-4173-b17b-406148083ab7" />

#Completed Task + AutoFlow Recalculation
<img width="574" height="426" alt="Screenshot 2026-09-20 201237" src="https://github.com/user-attachments/assets/d93391e1-ad42-447e-8ae9-34349191e5cc" />


#Project Goals:
The project was built to demonstrate practical implementation of:

Spring Boot backend development
REST API design
Database-driven applications
Authentication and authorization
WebSocket-based real-time communication
Collaborative application design
JPA/Hibernate persistence
Vanilla JavaScript frontend development

#License:
This project is currently intended as a personal academic and portfolio project.
