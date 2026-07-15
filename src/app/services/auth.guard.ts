import { Injectable }              from '@angular/core';
import { CanActivate, Router,
         ActivatedRouteSnapshot,
         RouterStateSnapshot }     from '@angular/router';
import { AuthService }             from '../services/auth.service';
import { map, take }               from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router:      Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ) {
    const otpValide = sessionStorage
      .getItem('otp_verified') === 'true';

    return this.authService.user$.pipe(
      take(1),
      map(user => {
        if (user && otpValide) {
          return true;
        }
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}