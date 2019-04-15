import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import { getTicketPrice, IEventOrder, orderToEventOrders } from '../../../../functions';
import * as reducers from '../../../../store/reducers';

@Component({
    selector: 'app-purchase-complete',
    templateUrl: './purchase-complete.component.html',
    styleUrls: ['./purchase-complete.component.scss']
})
export class PurchaseCompleteComponent implements OnInit {
    public purchase: Observable<reducers.IPurchaseState>;
    public moment: typeof moment = moment;
    public getTicketPrice = getTicketPrice;
    public eventOrders: IEventOrder[];

    constructor(
        private store: Store<reducers.IState>,
        private router: Router
    ) { }

    /**
     * 初期化
     */
    public ngOnInit() {
        this.eventOrders = [];
        this.purchase = this.store.pipe(select(reducers.getPurchase));
        this.purchase.subscribe((purchase) => {
            if (purchase.order === undefined) {
                this.router.navigate(['/error']);
                return;
            }
            const order = purchase.order;
            this.eventOrders = orderToEventOrders({ order });
        }).unsubscribe();
    }

}
