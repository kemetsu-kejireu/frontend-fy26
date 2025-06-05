import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductService } from './services/product.service';
import { Product } from './models/product.model';
import { Subscription, filter, Observable, of, combineLatest } from 'rxjs';
import { AuthService } from './services/auth.service';
import { map, take } from 'rxjs/operators';
import { OrderService } from './services/order.service';
import { MemberStatusResponse } from './models/member-status.model';
import { OrderRequest, OrderResponse } from './models/order.model';
import { LoggerService } from './services/logger.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy{
  public title = 'angular-project';
  private productService = inject(ProductService);
  public isCartVisible: boolean = false;
  public cartItems: Product[] = [];
  private addToCartSubscription: Subscription;
  private logger = inject(LoggerService);

  private navigationEndSubscription: Subscription | null = null;
  private router: Router = inject(Router);
  public showNavbar: boolean = false;

  public userName$: Observable<string | null>;
  public isMembershipMenuVisible: boolean = false;
  private authService: AuthService = inject(AuthService);

  public userUuid$: Observable<string | null>;
  public memberStatus$: Observable<MemberStatusResponse | null> = of(null);
  private orderService: OrderService = inject(OrderService);

  constructor() {
    this.addToCartSubscription = this.productService.onAddToCart$.subscribe((res:Product) => {
      this.cartItems.unshift(res);
      this.logger.logUserAction('add_to_cart', { productId: res.productId, productName: res.productName });
    });
    this.userName$ = this.authService.userName$;
    this.userUuid$ = this.authService.userUuid$;
    this.userUuid$.subscribe(uuid => {
      if (uuid) {
        this.memberStatus$ = this.orderService.fetchMemberStatus(uuid);
      }
    });
  }

  public ngOnInit(): void {
      this.navigationEndSubscription = this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          const urlWithoutParams = event.urlAfterRedirects.split('?')[0].split('#')[0]; // Ignore query parameters and fragments
          const noNavbarUrls = ['/login', '/register', '/forgot-password', '/reset-password'];
          this.showNavbar = !noNavbarUrls.some(url => new RegExp(`^${url}`).test(urlWithoutParams));
          
          // ページナビゲーションのログ
          this.logger.logUserAction('page_navigation', { 
            url: urlWithoutParams,
            showNavbar: this.showNavbar
          });
        });
  }

  public ngOnDestroy(): void {
    if(this.addToCartSubscription) {
      this.addToCartSubscription.unsubscribe();
    }

    if(this.navigationEndSubscription) {
      this.navigationEndSubscription.unsubscribe();
    }
  }

  public showCart(): void {
    this.isCartVisible = !this.isCartVisible;
    this.logger.logUserAction('toggle_cart', { isVisible: this.isCartVisible });
  }

  public trackByIndex(index: number, item: Product): number {
    return index;
  }

  public removeProduct(index: number): void {
    const removedProduct = this.cartItems[index];
    this.cartItems.splice(index, 1);
    this.logger.logUserAction('remove_from_cart', { 
      productId: removedProduct.productId, 
      productName: removedProduct.productName 
    });
  }

  public getTotalQuantity(): number {
    return this.cartItems.length;
  }

  public getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + Number(item.price), 0);
  }

  public showMembershipMenu(): void {
    this.isMembershipMenuVisible = !this.isMembershipMenuVisible;
    this.logger.logUserAction('toggle_membership_menu', { isVisible: this.isMembershipMenuVisible });
  }

  public onLogout(): void {
    const confirmed: boolean = confirm('Are you sure you want to logout?');
    if(confirmed) {
      this.logger.logUserAction('logout');
      this.authService.signOut().then(() => {
        this.isCartVisible = false;
        this.isMembershipMenuVisible = false;
        this.router.navigateByUrl('/login');
      });
    }
  }

  // Add new method for placing an order
  public onPlaceOrder(): void {
    this.logger.logUserAction('place_order_initiated', { 
      itemCount: this.getTotalQuantity(), 
      totalPrice: this.getTotalPrice() 
    });
    
    combineLatest([this.userUuid$, this.userName$]).pipe(
      take(1),
      map(([userId, userName]) => {
        if(!userId || !userName) {
          const error = new Error('User not authenticated');
          this.logger.logError(error, 'place_order');
          throw error;
        }
        return this.prepareOrderRequest(userId, userName);
      })  
    ).subscribe({
      next: (orderRequest) => {
        this.orderService.placeOrder(orderRequest).subscribe({
          next: (response: OrderResponse) => {
            this.handleOrderSuccess(response);
            if (orderRequest.userId) {
              this.calculateAndUpdateMemberStatus(orderRequest.userId, response.orderNumber);
            } else {
              const error = new Error('User ID is not available for member status update');
              this.logger.logError(error, 'member_status_update');
            }
          },
          error: (error) => this.handleOrderError(error)
        });
      },
      error: (error) => this.logger.logError(error, 'prepare_order_request')
    });
  }

  // Prepare the order request object
  private prepareOrderRequest(userId: string, userName: string): OrderRequest {
    return {
      userId,
      userName,
      totalPrice: this.getTotalPrice(),
      totalQuantity: this.getTotalQuantity(),
      orderItems: this.cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price
      }))
    };
  }

  // Handle order success
  private handleOrderSuccess(response: OrderResponse): void {
    this.logger.logUserAction('order_placed_success', { orderNumber: response.orderNumber });
    alert(`Order placed successfully. Order number: ${response.orderNumber}`);
    this.cartItems = []; // Clear the cart
    this.isCartVisible = false; // Hide the cart
  }

  // Handle order error
  private handleOrderError(error: any): void {
    this.logger.logError(error, 'place_order');
    alert(`Error placing order: ${error.message}`);
  }

  // Calculate membership status
  private calculateAndUpdateMemberStatus(userId: string, orderNumber: string): void {
    this.orderService.calculateAndUpdateMemberStatus(userId, orderNumber).pipe(
      take(1)
    ).subscribe({
      next: (status: MemberStatusResponse) => {
        this.logger.logUserAction('member_status_updated', { 
          points: status.points, 
          rank: status.rank 
        });
        alert(`Your updated membership status - Points: ${status.points}, Rank: ${status.rank}`);
        this.memberStatus$ = of(status);
      },
      error: (error) => {
        this.logger.logError(error, 'calculate_member_status');
        console.error('Error calculating member status:', error);
        alert(`Error calculating member status: ${error.message}`);
      }
    });
  }
}