import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import * as libphonenumber from 'libphonenumber-js';
import * as moment from 'moment';
import { Observable, race } from 'rxjs';
import { take, tap } from 'rxjs/operators';
import { ActionTypes, UpdateCustomer, UpdatePayment } from '../../../store/actions/user.action';
import * as reducers from '../../../store/reducers';
import { AlertModalComponent } from '../../parts/alert-modal/alert-modal.component';

@Component({
    selector: 'app-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.scss']
})
export class SettingComponent implements OnInit {
    public user: Observable<reducers.IUserState>;
    public isLoading: Observable<boolean>;
    public customerContactForm: FormGroup;
    public paymentForm: FormGroup;
    public cardExpiration: {
        year: string[];
        month: string[];
    };
    public amount: number;

    constructor(
        private store: Store<reducers.IState>,
        private actions: Actions,
        private modal: NgbModal,
        private formBuilder: FormBuilder
    ) { }

    public ngOnInit() {
        this.isLoading = this.store.pipe(select(reducers.getLoading));
        this.user = this.store.pipe(select(reducers.getUser));
        this.createCustomerContactForm();
        this.createPaymentForm();
    }

    private createCustomerContactForm() {
        const NAME_MAX_LENGTH = 12;
        const MAIL_MAX_LENGTH = 50;
        const TEL_MAX_LENGTH = 11;
        const TEL_MIN_LENGTH = 9;
        this.customerContactForm = this.formBuilder.group({
            familyName: ['', [
                Validators.required,
                Validators.maxLength(NAME_MAX_LENGTH),
                Validators.pattern(/^[ァ-ヶー]+$/)
            ]],
            givenName: ['', [
                Validators.required,
                Validators.maxLength(NAME_MAX_LENGTH),
                Validators.pattern(/^[ァ-ヶー]+$/)
            ]],
            email: ['', [
                Validators.required,
                Validators.maxLength(MAIL_MAX_LENGTH),
                Validators.email
            ]],
            telephone: ['', [
                Validators.required,
                Validators.maxLength(TEL_MAX_LENGTH),
                Validators.minLength(TEL_MIN_LENGTH),
                Validators.pattern(/^[0-9]+$/),
                (control: AbstractControl): ValidationErrors | null => {
                    const field = control.root.get('telephone');
                    if (field !== null) {
                        const parsedNumber = libphonenumber.parse(field.value, 'JP');
                        if (parsedNumber.phone === undefined) {
                            return { telephone: true };
                        }
                        const isValid = libphonenumber.isValidNumber(parsedNumber);
                        if (!isValid) {
                            return { telephone: true };
                        }
                    }

                    return null;
                }
            ]]
        });
        this.user.subscribe((user) => {
            if (user.profile === undefined) {
                return;
            }
            this.customerContactForm.controls.familyName.setValue(user.profile.familyName);
            this.customerContactForm.controls.givenName.setValue(user.profile.givenName);
            this.customerContactForm.controls.email.setValue(user.profile.email);
            this.customerContactForm.controls.telephone.setValue(user.profile.telephone);
        }).unsubscribe();
    }

    private createPaymentForm() {
        this.cardExpiration = {
            year: [],
            month: []
        };
        for (let i = 0; i < 12; i++) {
            this.cardExpiration.month.push(`0${String(i + 1)}`.slice(-2));
        }
        for (let i = 0; i < 10; i++) {
            this.cardExpiration.year.push(moment().add(i, 'year').format('YYYY'));
        }
        this.paymentForm = this.formBuilder.group({
            cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
            cardExpirationMonth: [this.cardExpiration.month[0], [Validators.required]],
            cardExpirationYear: [this.cardExpiration.year[0], [Validators.required]],
            securityCode: ['', [Validators.required]],
            holderName: ['', [Validators.required]]
        });
    }

    public updateCustomer() {
        Object.keys(this.customerContactForm.controls).forEach((key) => {
            this.customerContactForm.controls[key].markAsTouched();
        });
        this.customerContactForm.controls.familyName.setValue((<HTMLInputElement>document.getElementById('familyName')).value);
        this.customerContactForm.controls.givenName.setValue((<HTMLInputElement>document.getElementById('givenName')).value);
        this.customerContactForm.controls.email.setValue((<HTMLInputElement>document.getElementById('email')).value);
        this.customerContactForm.controls.telephone.setValue((<HTMLInputElement>document.getElementById('telephone')).value);
        if (this.customerContactForm.invalid) {
            this.openAlert({
                title: 'エラー',
                body: '購入者情報に誤りがあります。'
            });
            return;
        }

        const profile = {
            givenName: this.customerContactForm.controls.givenName.value,
            familyName: this.customerContactForm.controls.familyName.value,
            telephone: this.customerContactForm.controls.telephone.value,
            email: this.customerContactForm.controls.email.value,
        };
        this.store.dispatch(new UpdateCustomer({ profile }));

        const success = this.actions.pipe(
            ofType(ActionTypes.UpdateCustomerSuccess),
            tap(() => { })
        );

        const fail = this.actions.pipe(
            ofType(ActionTypes.UpdateCustomerFail),
            tap(() => { })
        );
        race(success, fail).pipe(take(1)).subscribe();
    }

    public updatePayment() {
        Object.keys(this.paymentForm.controls).forEach((key) => {
            this.paymentForm.controls[key].markAsTouched();
        });

        this.paymentForm.controls.cardNumber.setValue((<HTMLInputElement>document.getElementById('cardNumber')).value);
        this.paymentForm.controls.securityCode.setValue((<HTMLInputElement>document.getElementById('securityCode')).value);
        this.paymentForm.controls.holderName.setValue((<HTMLInputElement>document.getElementById('holderName')).value);

        if (this.paymentForm.invalid) {
            this.openAlert({
                title: 'エラー',
                body: '決済情報に誤りがあります。'
            });
            return;
        }

        this.store.dispatch(new UpdatePayment());

        const success = this.actions.pipe(
            ofType(ActionTypes.UpdatePaymentSuccess),
            tap(() => { })
        );

        const fail = this.actions.pipe(
            ofType(ActionTypes.UpdatePaymentFail),
            tap(() => { })
        );
        race(success, fail).pipe(take(1)).subscribe();
    }

    public openAlert(args: {
        title: string;
        body: string;
    }) {
        const modalRef = this.modal.open(AlertModalComponent, {
            centered: true
        });
        modalRef.componentInstance.title = args.title;
        modalRef.componentInstance.body = args.body;
    }

}
