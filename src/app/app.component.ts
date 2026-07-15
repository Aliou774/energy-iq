import { Component, OnInit }         from '@angular/core';
import { Router, NavigationEnd }     from '@angular/router';
import { AuthService }               from './services/auth.service';
import { filter }                    from 'rxjs/operators';

@Component({
  selector:    'app-root',
  templateUrl: './app.component.html',
  styleUrls:   ['./app.component.scss']
})
export class AppComponent implements OnInit {

  isLoggedIn  = false;
  showSidebar = false;

  private routesSansMenu = ['/login', '/register'];

  constructor(
    private authService: AuthService,
    private router:      Router
  ) {}

  ngOnInit() {
    this.authService.isLoggedIn().subscribe(
      (connecte: boolean) => {
        this.isLoggedIn = connecte;
        this.majSidebar();
      }
    );

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      this.majSidebar();
    });
  }

  private majSidebar() {
    const url       = this.router.url;
    const otpValide = sessionStorage
      .getItem('otp_verified') === 'true';
    const pagePub   = this.routesSansMenu
      .some(r => url.startsWith(r));

    this.showSidebar = this.isLoggedIn
      && otpValide
      && !pagePub;
  }
}