import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtAccessStrategy, RefreshStrategy } from './strategies';
import { JwtAuthGuard, RefreshAuthGuard, SecurityGuard } from './guards';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtAccessStrategy, RefreshStrategy, JwtAuthGuard, RefreshAuthGuard, SecurityGuard],
  exports: [AuthService, PasswordService, JwtAuthGuard, SecurityGuard],
})
export class AuthModule {}
