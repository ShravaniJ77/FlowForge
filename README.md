# FlowForge — Real-Time Collaborative Kanban

A Spring Boot + MySQL + WebSocket Kanban board starter with a polished browser UI.

## Stack
- Java 17
- Spring Boot 3.5
- Spring Web
- Spring Data JPA
- MySQL
- WebSocket/STOMP
- Vanilla HTML/CSS/JavaScript

## Run
1. Create a MySQL database named `flowforge`.
2. Open `src/main/resources/application.properties` and set your MySQL username/password.
3. Run:
   `mvn spring-boot:run`
4. Open http://localhost:8080

The project is intentionally straightforward so you can extend it and learn the architecture afterward.

## Current features
- Board with To Do / In Progress / Done columns
- Create tasks
- Drag/drop cards between columns
- Persistent MySQL storage
- WebSocket broadcast when cards move or are created
- Responsive UI
- REST API

## Planned resume differentiators
- Authentication and board membership
- Task dependencies
- Java prioritization engine
- Productivity analytics
- Activity history
