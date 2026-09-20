package com.flowforge.service;

import com.flowforge.model.Board;
import com.flowforge.model.Task;
import com.flowforge.model.User;
import com.flowforge.repo.BoardRepository;
import com.flowforge.repo.TaskRepository;
import com.flowforge.repo.UserRepository;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BoardMigrationService implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final BoardService boardService;

    public BoardMigrationService(
            UserRepository userRepository,
            BoardRepository boardRepository,
            TaskRepository taskRepository,
            BoardService boardService) {

        this.userRepository = userRepository;
        this.boardRepository = boardRepository;
        this.taskRepository = taskRepository;
        this.boardService = boardService;
    }

    @Override
    public void run(String... args) {

        List<User> users = userRepository.findAll();

        if (users.isEmpty()) {
            return;
        }

        /*
         * Give every existing user a personal workspace
         * if they don't already have one.
         */
        for (User user : users) {

            if (boardService.getMyBoards(user).isEmpty()) {

                boardService.createBoard(
                        user,
                        "My Workspace"
                );
            }
        }

        /*
         * Preserve old tasks by attaching orphan tasks
         * to the first user's first board.
         */
        List<Task> orphanTasks =
                taskRepository.findByBoardIsNullOrderByPositionAsc();

        if (orphanTasks.isEmpty()) {
            return;
        }

        User firstUser = users.get(0);

        Board board =
                boardService
                        .getMyBoards(firstUser)
                        .get(0);

        for (Task task : orphanTasks) {
            task.setBoard(board);
        }

        taskRepository.saveAll(orphanTasks);

        System.out.println(
                "FlowForge migration: attached "
                + orphanTasks.size()
                + " existing task(s) to "
                + board.getName()
        );
    }
}