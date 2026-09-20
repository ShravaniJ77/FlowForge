package com.flowforge.web;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.flowforge.model.Board;
import com.flowforge.model.BoardMember;
import com.flowforge.model.User;
import com.flowforge.service.BoardService;
import com.flowforge.service.CurrentUserService;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/boards")
public class BoardController {

    private final BoardService boardService;
    private final CurrentUserService currentUserService;
    private final SimpMessagingTemplate messaging;

    public BoardController(
            BoardService boardService,
            CurrentUserService currentUserService,
            SimpMessagingTemplate messaging) {

        this.boardService = boardService;
        this.currentUserService = currentUserService;
        this.messaging = messaging;
    }

    // ============================================================
    // GET — MY BOARDS
    // ============================================================

    @GetMapping
    public List<BoardResponse> myBoards(
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        return boardService
                .getMyBoards(user)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ============================================================
    // CREATE BOARD
    // ============================================================

    @PostMapping
    public BoardResponse createBoard(
            @RequestBody CreateBoardRequest request,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        Board board =
                boardService.createBoard(
                        user,
                        request.name()
                );

        return toResponse(board);
    }

    // ============================================================
    // GET BOARD MEMBERS
    // ============================================================

    @GetMapping("/{boardId}/members")
    public List<MemberResponse> members(
            @PathVariable Long boardId,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        return boardService
                .getMembers(boardId, user)
                .stream()
                .map(this::toMemberResponse)
                .toList();
    }

    // ============================================================
    // OWNER — ADD MEMBER
    // ============================================================

    @PostMapping("/{boardId}/members")
    public MemberResponse addMember(
            @PathVariable Long boardId,
            @RequestBody AddMemberRequest request,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        BoardMember member =
                boardService.addMember(
                        boardId,
                        request.email(),
                        user
                );

        Board board = member.getBoard();

        messaging.convertAndSendToUser(
                member.getUser().getEmail(),
                "/queue/boards",
                java.util.Map.of(
                        "type", "BOARD_ADDED",
                        "boardId", board.getId(),
                        "boardName", board.getName()
                )
        );

        return toMemberResponse(member);
    }

    // ============================================================
    // OWNER — REMOVE MEMBER
    // ============================================================

    @DeleteMapping("/{boardId}/members/{memberId}")
    public java.util.Map<String, String> removeMember(
            @PathVariable Long boardId,
            @PathVariable Long memberId,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        BoardMember removedMember =
                boardService.removeMember(
                        boardId,
                        memberId,
                        user
                );

        messaging.convertAndSendToUser(
                removedMember.getUser().getEmail(),
                "/queue/boards",
                java.util.Map.of(
                        "type", "MEMBER_REMOVED",
                        "boardId", boardId,
                        "boardName",
                        removedMember.getBoard().getName()
                )
        );

        return java.util.Map.of(
                "message",
                "Member removed from the board"
        );
    }

    // ============================================================
    // OWNER — DELETE BOARD
    // ============================================================

    @DeleteMapping("/{boardId}")
    public java.util.Map<String, String> deleteBoard(
            @PathVariable Long boardId,
            Authentication authentication) {

        User user =
                currentUserService.getCurrentUser(
                        authentication
                );

        // Get board and members BEFORE deletion
        Board board =
                boardService.getBoardForUser(
                        boardId,
                        user
                );

        List<BoardMember> members =
                boardService.getMembers(
                        boardId,
                        user
                );

        String boardName = board.getName();

        // Store member emails BEFORE deleting the board
        List<String> memberEmails =
                members.stream()
                        .filter(member ->
                                !member.getUser().getId()
                                        .equals(
                                                board.getOwner().getId()
                                        )
                        )
                        .map(member ->
                                member.getUser().getEmail()
                        )
                        .toList();

        // ========================================================
        // FIRST: DELETE THE BOARD
        // ========================================================

        boardService.deleteBoard(
                boardId,
                user
        );

        // ========================================================
        // THEN: NOTIFY THE MEMBERS
        // ========================================================

        for (String email : memberEmails) {

            messaging.convertAndSendToUser(
                    email,
                    "/queue/boards",
                    java.util.Map.of(
                            "type", "BOARD_DELETED",
                            "boardId", boardId,
                            "boardName", boardName
                    )
            );
        }

        return java.util.Map.of(
                "message",
                "Board deleted successfully"
        );
    }

    // ============================================================
    // BOARD RESPONSE
    // ============================================================

    private BoardResponse toResponse(Board board) {

        return new BoardResponse(
                board.getId(),
                board.getName(),
                board.getOwner().getId(),
                board.getOwner().getUsername(),
                board.getCreatedAt(),
                board.getUpdatedAt()
        );
    }

    // ============================================================
    // MEMBER RESPONSE
    // ============================================================

    private MemberResponse toMemberResponse(
            BoardMember member) {

        return new MemberResponse(
                member.getId(),
                member.getUser().getId(),
                member.getUser().getUsername(),
                member.getUser().getEmail(),
                member.getRole(),
                member.getJoinedAt()
        );
    }

    // ============================================================
    // REQUEST / RESPONSE RECORDS
    // ============================================================

    public record CreateBoardRequest(
            String name
    ) {}

    public record AddMemberRequest(
            String email
    ) {}

    public record BoardResponse(
            Long id,
            String name,
            Long ownerId,
            String ownerUsername,
            java.time.LocalDateTime createdAt,
            java.time.LocalDateTime updatedAt
    ) {}

    public record MemberResponse(
            Long id,
            Long userId,
            String username,
            String email,
            String role,
            java.time.LocalDateTime joinedAt
    ) {}
}