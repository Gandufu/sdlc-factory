package dev.sdlc.factory.app.web;

import dev.sdlc.factory.contracts.gate.GateCommand;
import dev.sdlc.factory.contracts.gate.GateResult;
import dev.sdlc.factory.gate.GateService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 门禁 REST 入口。
 *
 * <p>所有状态迁移必须提交明确命令并由 Guard 校验；
 * UI 拖拽或聊天文本不能替代本命令。</p>
 */
@RestController
@RequestMapping("/api/gates")
public class GateController {

    private final GateService gateService;

    public GateController(GateService gateService) {
        this.gateService = gateService;
    }

    /** 提交门禁裁决命令。 */
    @PostMapping
    public GateResult decide(@RequestBody GateCommand command) {
        return gateService.decide(command);
    }
}
