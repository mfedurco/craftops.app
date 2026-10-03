package app.craftops.fabric.mixin;

import app.craftops.fabric.FabricEvents;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(CommandManager.class)
public class CommandManagerMixin {
    @Inject(method = "executeWithPrefix", at = @At("HEAD"))
    private void craftops$onExecute(ServerCommandSource source, String command, CallbackInfoReturnable<Integer> cir) {
        if (FabricEvents.events() == null) {
            return;
        }
        ServerPlayerEntity player = source.getPlayer();
        if (player == null) {
            return;
        }
        FabricEvents.events().add(FabricEvents.command(player, command));
    }
}
