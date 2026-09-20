package com.flowforge.web;

import com.flowforge.model.Board;
import com.flowforge.model.BoardMember;
import com.flowforge.model.Task;
import com.flowforge.model.User;
import com.flowforge.service.BoardService;
import com.flowforge.service.CurrentUserService;
import com.flowforge.service.TaskService;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final BoardService boardService;
    private final CurrentUserService currentUserService;
    private final SimpMessagingTemplate messaging;

    public TaskController(
            TaskService taskService,
            BoardService boardService,
            CurrentUserService currentUserService,
            SimpMessagingTemplate messaging) {

        this.taskService = taskService;
        this.boardService = boardService;
        this.currentUserService = currentUserService;
        this.messaging = messaging;
    }

    // =========================================================
    // GET ALL TASKS FOR A BOARD
    // =========================================================

    @GetMapping
    public List<TaskResponse> all(
            @RequestParam Long boardId,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        return taskService.all(board)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // =========================================================
    // CREATE TASK
    // =========================================================

    @PostMapping
    public TaskResponse create(
            @RequestParam Long boardId,
            @RequestBody TaskRequest request,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        Task task = new Task();

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setDueDate(request.dueDate());
        task.setEstimatedMinutes(
                request.estimatedMinutes()
        );

        if (request.dependsOnId() != null) {

            Task dependency =
                    taskService.findByIdForBoard(
                            request.dependsOnId(),
                            board
                    );

            task.setDependsOn(dependency);
        }

        Task saved =
                taskService.create(
                        task,
                        board
                );

        TaskResponse response =
                toResponse(saved);

        broadcast(
                board,
                Map.of(
                        "type", "CREATED",
                        "boardId", board.getId(),
                        "task", response
                )
        );

        return response;
    }

    // =========================================================
    // MOVE TASK
    // =========================================================

    @PatchMapping("/{id}/move")
    public TaskResponse move(
            @PathVariable Long id,
            @RequestParam Long boardId,
            @RequestBody MoveRequest request,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        Task saved =
                taskService.move(
                        id,
                        board,
                        request.status(),
                        request.position()
                );

        TaskResponse response =
                toResponse(saved);

        broadcast(
                board,
                Map.of(
                        "type", "MOVED",
                        "boardId", board.getId(),
                        "task", response
                )
        );

        return response;
    }

    // =========================================================
    // UPDATE TASK
    // =========================================================

    @PutMapping("/{id}")
    public TaskResponse update(
            @PathVariable Long id,
            @RequestParam Long boardId,
            @RequestBody TaskRequest request,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        Task updatedTask =
                new Task();

        updatedTask.setTitle(request.title());
        updatedTask.setDescription(request.description());
        updatedTask.setPriority(request.priority());
        updatedTask.setStatus(request.status());
        updatedTask.setDueDate(request.dueDate());
        updatedTask.setEstimatedMinutes(
                request.estimatedMinutes()
        );

        if (request.dependsOnId() != null) {

            Task dependency =
                    taskService.findByIdForBoard(
                            request.dependsOnId(),
                            board
                    );

            updatedTask.setDependsOn(
                    dependency
            );
        }

        Task saved =
                taskService.update(
                        id,
                        board,
                        updatedTask
                );

        TaskResponse response =
                toResponse(saved);

        broadcast(
                board,
                Map.of(
                        "type", "UPDATED",
                        "boardId", board.getId(),
                        "task", response
                )
        );

        return response;
    }

    // =========================================================
    // DELETE TASK
    // =========================================================

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(
            @PathVariable Long id,
            @RequestParam Long boardId,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        taskService.delete(
                id,
                board
        );

        broadcast(
                board,
                Map.of(
                        "type", "DELETED",
                        "boardId", board.getId(),
                        "taskId", id
                )
        );

        return Map.of(
                "message",
                "Task deleted successfully",
                "taskId",
                id
        );
    }

    // =========================================================
    // WEBSOCKET BROADCAST
    // =========================================================

    private void broadcast(Board board, Map<String, Object> payload) {
    List<BoardMember> members =
            boardService.getMembers(board.getId(), board.getOwner());

   

    for (BoardMember member : members) {

        String email = member.getUser().getEmail();

       

        messaging.convertAndSendToUser(
                email,
                "/queue/tasks",
                payload
        );
    }
}

    // =========================================================
    // RESPONSE CONVERSION
    // =========================================================

    private TaskResponse toResponse(
            Task task) {

        DependencyResponse dependency =
                null;

        if (task.getDependsOn() != null) {

            dependency =
                    new DependencyResponse(
                            task.getDependsOn().getId(),
                            task.getDependsOn().getTitle(),
                            task.getDependsOn().getStatus()
                    );
        }

        return new TaskResponse(
                task.getId(),
                task.getBoard() != null
                        ? task.getBoard().getId()
                        : null,
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getPriority(),
                task.getDueDate(),
                task.getPosition(),
                task.getCreatedAt(),
                task.getUpdatedAt(),
                task.getEstimatedMinutes(),
                dependency
        );
    }

    // =========================================================
    // REQUEST RECORDS
    // =========================================================

    public record TaskRequest(
            String title,
            String description,
            String status,
            String priority,
            LocalDate dueDate,
            Integer estimatedMinutes,
            Long dependsOnId
    ) {}

    public record MoveRequest(
            String status,
            Integer position
    ) {}

    // =========================================================
    // RESPONSE RECORDS
    // =========================================================

    public record TaskResponse(
            Long id,
            Long boardId,
            String title,
            String description,
            String status,
            String priority,
            LocalDate dueDate,
            Integer position,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Integer estimatedMinutes,
            DependencyResponse dependsOn
    ) {}

    public record DependencyResponse(
            Long id,
            String title,
            String status
    ) {}
}