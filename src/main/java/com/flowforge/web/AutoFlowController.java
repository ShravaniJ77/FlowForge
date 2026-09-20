package com.flowforge.web;

import com.flowforge.model.Board;
import com.flowforge.model.User;
import com.flowforge.service.AutoFlowService;
import com.flowforge.service.BoardService;
import com.flowforge.service.CurrentUserService;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/autoflow")
public class AutoFlowController {

    private final AutoFlowService autoFlowService;
    private final BoardService boardService;
    private final CurrentUserService currentUserService;

    public AutoFlowController(
            AutoFlowService autoFlowService,
            BoardService boardService,
            CurrentUserService currentUserService) {

        this.autoFlowService = autoFlowService;
        this.boardService = boardService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public AutoFlowService.AutoFlowResult analyze(
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

        return autoFlowService.analyze(board);
    }
}