import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { factory } from '@cinerino/api-javascript-client';
import { Actions, Effect, ofType } from '@ngrx/effects';
import * as moment from 'moment';
import { map, mergeMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
    createGmoTokenObject,
    createMovieTicketsFromAuthorizeSeatReservation,
    formatTelephone,
    isTicketedSeatScreeningEvent
} from '../../functions';
import { IScreen } from '../../models';
import { CinerinoService } from '../../services';
import { purchaseAction } from '../actions';

/**
 * Purchase Effects
 */
@Injectable()
export class PurchaseEffects {

    constructor(
        private actions: Actions,
        private cinerino: CinerinoService,
        private http: HttpClient
    ) { }

    /**
     * GetPreScheduleDates
     */
    @Effect()
    public getPreScheduleDates = this.actions.pipe(
        ofType<purchaseAction.GetPreScheduleDates>(purchaseAction.ActionTypes.GetPreScheduleDates),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                await this.cinerino.getServices();
                const now = moment().toDate();
                const today = moment(moment().format('YYYY-MM-DD')).toDate();
                const limit = 100;
                let page = 1;
                let roop = true;
                let screeningEvents: factory.chevre.event.screeningEvent.IEvent[] = [];
                while (roop) {
                    const screeningEventsResult = await this.cinerino.event.searchScreeningEvents({
                        page,
                        limit,
                        typeOf: factory.chevre.eventType.ScreeningEvent,
                        eventStatuses: [factory.chevre.eventStatusType.EventScheduled],
                        superEvent: payload.superEvent,
                        startFrom: moment(today).add(environment.PURCHASE_PRE_SCHEDULE_DATE, 'days').toDate(),
                        offers: {
                            validFrom: now,
                            validThrough: now,
                            availableFrom: now,
                            availableThrough: now
                        }
                    });
                    screeningEvents = screeningEvents.concat(screeningEventsResult.data);
                    const lastPage = Math.ceil(screeningEventsResult.totalCount / limit);
                    page++;
                    roop = !(page > lastPage);
                }
                const sheduleDates: string[] = [];

                screeningEvents.forEach((screeningEvent) => {
                    const date = moment(screeningEvent.startDate).format('YYYY-MM-DD');
                    const findResult = sheduleDates.find(sheduleDat => sheduleDat === date);
                    if (findResult === undefined) {
                        sheduleDates.push(date);
                    }
                });

                return new purchaseAction.GetPreScheduleDatesSuccess({ sheduleDates });
            } catch (error) {
                return new purchaseAction.GetPreScheduleDatesFail({ error: error });
            }
        })
    );

    /**
     * StartTransaction
     */
    @Effect()
    public startTransaction = this.actions.pipe(
        ofType<purchaseAction.StartTransaction>(purchaseAction.ActionTypes.StartTransaction),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                const params = payload.params;
                const selleId = params.seller.id;
                await this.cinerino.getServices();
                const passport = await this.cinerino.getPassport(selleId);
                params.object = { passport };
                const transaction = await this.cinerino.transaction.placeOrder.start(params);
                return new purchaseAction.StartTransactionSuccess({ transaction });
            } catch (error) {
                return new purchaseAction.StartTransactionFail({ error: error });
            }
        })
    );

    /**
     * getScreen
     */
    @Effect()
    public getScreen = this.actions.pipe(
        ofType<purchaseAction.GetScreen>(purchaseAction.ActionTypes.GetScreen),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                await this.cinerino.getServices();
                const screeningEventOffers = await this.cinerino.event.searchScreeningEventOffers({
                    eventId: payload.screeningEvent.id
                });
                const theaterCode = payload.screeningEvent.superEvent.location.branchCode;
                const screenCode = `000${payload.screeningEvent.location.branchCode}`.slice(-3);
                const screen = await this.http.get<IScreen>(`/json/theater/${theaterCode}/${screenCode}.json`).toPromise();
                const setting = await this.http.get<IScreen>('/json/theater/setting.json').toPromise();
                const screenData = Object.assign(setting, screen);
                return new purchaseAction.GetScreenSuccess({ screeningEventOffers, screenData });
            } catch (error) {
                return new purchaseAction.GetScreenFail({ error: error });
            }
        })
    );

    /**
     * temporaryReservation
     */
    @Effect()
    public temporaryReservation = this.actions.pipe(
        ofType<purchaseAction.TemporaryReservation>(purchaseAction.ActionTypes.TemporaryReservation),
        map(action => action.payload),
        mergeMap(async (payload) => {
            const transaction = payload.transaction;
            const screeningEvent = payload.screeningEvent;
            const reservations = payload.reservations;
            try {
                await this.cinerino.getServices();
                if (payload.authorizeSeatReservation !== undefined) {
                    await this.cinerino.transaction.placeOrder.voidSeatReservation(payload.authorizeSeatReservation);
                }
                const authorizeSeatReservation = await this.cinerino.transaction.placeOrder.authorizeSeatReservation({
                    object: {
                        event: {
                            id: screeningEvent.id
                        },
                        acceptedOffer: reservations.map((reservation) => {
                            if (reservation.ticket === undefined) {
                                throw new Error('ticket is undefined');
                            }
                            return {
                                id: reservation.ticket.ticketOffer.id,
                                ticketedSeat: reservation.seat,
                                additionalProperty: [] // ここにムビチケ情報を入れる
                            };
                        })
                    },
                    purpose: transaction
                });
                return new purchaseAction.TemporaryReservationSuccess({
                    addAuthorizeSeatReservation: authorizeSeatReservation,
                    removeAuthorizeSeatReservation: payload.authorizeSeatReservation
                });
            } catch (error) {
                return new purchaseAction.TemporaryReservationFail({ error: error });
            }
        })
    );

    /**
     * temporaryReservationFreeSeat
     */
    @Effect()
    public temporaryReservationFreeSeat = this.actions.pipe(
        ofType<purchaseAction.TemporaryReservationFreeSeat>(purchaseAction.ActionTypes.TemporaryReservationFreeSeat),
        map(action => action.payload),
        mergeMap(async (payload) => {
            const transaction = payload.transaction;
            const screeningEvent = payload.screeningEvent;
            const reservationTickets = payload.reservationTickets;
            const freeSeats: factory.chevre.reservation.ISeat<factory.chevre.reservationType.EventReservation>[] = [];
            try {
                await this.cinerino.getServices();
                if (isTicketedSeatScreeningEvent(screeningEvent)) {
                    const screeningEventOffers = await this.cinerino.event.searchScreeningEventOffers({
                        eventId: payload.screeningEvent.id
                    });
                    for (const screeningEventOffer of screeningEventOffers) {
                        const section = screeningEventOffer.branchCode;
                        for (const containsPlace of screeningEventOffer.containsPlace) {
                            if (containsPlace.offers !== undefined
                                && containsPlace.offers[0].availability === factory.chevre.itemAvailability.InStock) {
                                freeSeats.push({
                                    typeOf: containsPlace.typeOf,
                                    seatingType: <any>containsPlace.seatingType,
                                    seatNumber: containsPlace.branchCode,
                                    seatRow: '',
                                    seatSection: section
                                });
                            }
                        }
                    }
                }
                const authorizeSeatReservation = await this.cinerino.transaction.placeOrder.authorizeSeatReservation({
                    object: {
                        event: {
                            id: screeningEvent.id
                        },
                        acceptedOffer: reservationTickets.map((ticket, index) => {
                            return {
                                id: ticket.ticketOffer.id,
                                ticketedSeat: (freeSeats.length > 0) ? freeSeats[index] : undefined,
                                additionalProperty: [] // ここにムビチケ情報を入れる
                            };
                        })
                    },
                    purpose: transaction
                });
                return new purchaseAction.TemporaryReservationFreeSeatSuccess({
                    addAuthorizeSeatReservation: authorizeSeatReservation
                });
            } catch (error) {
                return new purchaseAction.TemporaryReservationFreeSeatFail({ error: error });
            }
        })
    );

    /**
     * cancelTemporaryReservation
     */
    @Effect()
    public cancelTemporaryReservation = this.actions.pipe(
        ofType<purchaseAction.CancelTemporaryReservations>(purchaseAction.ActionTypes.CancelTemporaryReservations),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                const authorizeSeatReservations = payload.authorizeSeatReservations;
                await this.cinerino.getServices();
                for (const authorizeSeatReservation of authorizeSeatReservations) {
                    await this.cinerino.transaction.placeOrder.voidSeatReservation(authorizeSeatReservation);
                }

                return new purchaseAction.CancelTemporaryReservationsSuccess({ authorizeSeatReservations });
            } catch (error) {
                return new purchaseAction.CancelTemporaryReservationsFail({ error: error });
            }
        })
    );

    /**
     * getTicketList
     */
    @Effect()
    public getTicketList = this.actions.pipe(
        ofType<purchaseAction.GetTicketList>(purchaseAction.ActionTypes.GetTicketList),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                await this.cinerino.getServices();
                const screeningEventTicketOffers = await this.cinerino.event.searchScreeningEventTicketOffers({
                    event: { id: payload.screeningEvent.id },
                    seller: {
                        typeOf: payload.seller.typeOf,
                        id: payload.seller.id
                    },
                    store: { id: this.cinerino.auth.options.clientId }
                });

                return new purchaseAction.GetTicketListSuccess({ screeningEventTicketOffers });
            } catch (error) {
                return new purchaseAction.GetTicketListFail({ error: error });
            }
        })
    );

    /**
     * registerContact
     */
    @Effect()
    public registerContact = this.actions.pipe(
        ofType<purchaseAction.RegisterContact>(purchaseAction.ActionTypes.RegisterContact),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                const transaction = payload.transaction;
                const contact = payload.contact;
                if (contact.telephone !== undefined) {
                    contact.telephone = formatTelephone(contact.telephone);
                }
                await this.cinerino.getServices();
                const customerContact =
                    await this.cinerino.transaction.placeOrder.setCustomerContact({
                        id: transaction.id,
                        object: {
                            customerContact: contact
                        }
                    });

                return new purchaseAction.RegisterContactSuccess({ customerContact });
            } catch (error) {
                return new purchaseAction.RegisterContactFail({ error: error });
            }
        })
    );

    /**
     * authorizeCreditCard
     */
    @Effect()
    public authorizeCreditCard = this.actions.pipe(
        ofType<purchaseAction.AuthorizeCreditCard>(purchaseAction.ActionTypes.AuthorizeCreditCard),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                const creditCard = payload.creditCard;
                const amount = payload.amount;
                await this.cinerino.getServices();
                if (payload.authorizeCreditCardPayment !== undefined) {
                    await this.cinerino.transaction.placeOrder.voidPayment(payload.authorizeCreditCardPayment);
                }
                const transaction = payload.transaction;
                const authorizeCreditCardPaymentResult =
                    await this.cinerino.transaction.placeOrder.authorizeCreditCardPayment({
                        object: {
                            typeOf: factory.paymentMethodType.CreditCard,
                            amount,
                            method: <any>'1',
                            creditCard
                        },
                        purpose: transaction
                    });

                return new purchaseAction.AuthorizeCreditCardSuccess({ authorizeCreditCardPayment: authorizeCreditCardPaymentResult });
            } catch (error) {
                return new purchaseAction.AuthorizeCreditCardFail({ error: error });
            }
        })
    );

    /**
     * createGmoTokenObject
     */
    @Effect()
    public createGmoTokenObject = this.actions.pipe(
        ofType<purchaseAction.CreateGmoTokenObject>(purchaseAction.ActionTypes.CreateGmoTokenObject),
        map(action => action.payload),
        mergeMap(async (payload) => {
            const creditCard = payload.creditCard;
            const seller = payload.seller;
            try {
                const gmoTokenObject = await createGmoTokenObject({ creditCard, seller, });

                return new purchaseAction.CreateGmoTokenObjectSuccess({ gmoTokenObject });
            } catch (error) {
                return new purchaseAction.CreateGmoTokenObjectFail({ error: error });
            }
        })
    );

    /**
     * authorizeMovieTicket
     */
    @Effect()
    public authorizeMovieTicket = this.actions.pipe(
        ofType<purchaseAction.AuthorizeMovieTicket>(purchaseAction.ActionTypes.AuthorizeMovieTicket),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                await this.cinerino.getServices();
                if (payload.authorizeMovieTicketPayments.length > 0) {
                    for (const authorizeMovieTicketPayment of payload.authorizeMovieTicketPayments) {
                        await this.cinerino.transaction.placeOrder.voidPayment(authorizeMovieTicketPayment);
                    }
                }
                const transaction = payload.transaction;
                const pendingMovieTickets = payload.pendingMovieTickets;
                const authorizeSeatReservations = payload.authorizeSeatReservations;
                const authorizeMovieTicketPayments: factory.action.authorize.paymentMethod.movieTicket.IAction[] = [];
                for (const authorizeSeatReservation of authorizeSeatReservations) {
                    const movieTickets = createMovieTicketsFromAuthorizeSeatReservation({
                        authorizeSeatReservation, pendingMovieTickets
                    });
                    const movieTicketIdentifiers: {
                        identifier: string;
                        movieTickets: factory.paymentMethod.paymentCard.movieTicket.IMovieTicket[]
                    }[] = [];
                    movieTickets.forEach((movieTicket) => {
                        const findResult = movieTicketIdentifiers.find((movieTicketIdentifier) => {
                            return (movieTicketIdentifier.identifier === movieTicket.identifier);
                        });
                        if (findResult === undefined) {
                            movieTicketIdentifiers.push({
                                identifier: movieTicket.identifier, movieTickets: [movieTicket]
                            });
                            return;
                        }
                        findResult.movieTickets.push(movieTicket);
                    });
                    for (const movieTicketIdentifier of movieTicketIdentifiers) {
                        const authorizeMovieTicketPaymentResult = await this.cinerino.transaction.placeOrder.authorizeMovieTicketPayment({
                            object: {
                                typeOf: factory.paymentMethodType.MovieTicket,
                                amount: 0,
                                movieTickets: movieTicketIdentifier.movieTickets
                            },
                            purpose: transaction
                        });
                        authorizeMovieTicketPayments.push(authorizeMovieTicketPaymentResult);
                    }
                }

                return new purchaseAction.AuthorizeMovieTicketSuccess({ authorizeMovieTicketPayments });
            } catch (error) {
                return new purchaseAction.AuthorizeMovieTicketFail({ error: error });
            }
        })
    );
    /**
     * checkMovieTicket
     */
    @Effect()
    public checkMovieTicket = this.actions.pipe(
        ofType<purchaseAction.CheckMovieTicket>(purchaseAction.ActionTypes.CheckMovieTicket),
        map(action => action.payload),
        mergeMap(async (payload) => {
            try {
                await this.cinerino.getServices();
                const screeningEvent = payload.screeningEvent;
                const movieTickets = payload.movieTickets;
                const checkMovieTicketAction = await this.cinerino.payment.checkMovieTicket({
                    typeOf: factory.paymentMethodType.MovieTicket,
                    movieTickets: movieTickets.map((movieTicket) => {
                        return {
                            ...movieTicket,
                            serviceType: '', // 情報空でよし
                            serviceOutput: {
                                reservationFor: {
                                    typeOf: screeningEvent.typeOf,
                                    id: screeningEvent.id
                                },
                                reservedTicket: {
                                    ticketedSeat: {
                                        typeOf: factory.chevre.placeType.Seat,
                                        seatingType: <any>'', // 情報空でよし
                                        seatNumber: '', // 情報空でよし
                                        seatRow: '', // 情報空でよし
                                        seatSection: '' // 情報空でよし
                                    }
                                }
                            }
                        };
                    }),
                    seller: {
                        typeOf: payload.transaction.seller.typeOf,
                        id: payload.transaction.seller.id
                    }
                });

                return new purchaseAction.CheckMovieTicketSuccess({ checkMovieTicketAction });
            } catch (error) {
                return new purchaseAction.CheckMovieTicketFail({ error: error });
            }
        })
    );

    /**
     * reserve
     */
    @Effect()
    public reserve = this.actions.pipe(
        ofType<purchaseAction.Reserve>(purchaseAction.ActionTypes.Reserve),
        map(action => action.payload),
        mergeMap(async (payload) => {
            const transaction = payload.transaction;
            try {
                await this.cinerino.getServices();
                const result = await this.cinerino.transaction.placeOrder.confirm({
                    id: transaction.id,
                    options: {
                        sendEmailMessage: true
                    }
                });
                const order = result.order;
                return new purchaseAction.ReserveSuccess({ order });
            } catch (error) {
                await this.cinerino.transaction.placeOrder.cancel({
                    id: transaction.id
                });
                return new purchaseAction.ReserveFail({ error: error });
            }
        })
    );

    /**
     * ConvertExternalToPurchase
     */
    @Effect()
    public convertExternalToPurchase = this.actions.pipe(
        ofType<purchaseAction.ConvertExternalToPurchase>(purchaseAction.ActionTypes.ConvertExternalToPurchase),
        map(action => action.payload),
        mergeMap(async (payload) => {
            const eventId = payload.eventId;
            const sellerId = payload.sellerId;
            try {
                await this.cinerino.getServices();
                const screeningEvent = await this.cinerino.event.findScreeningEventById({ id: eventId });
                const seller = await this.cinerino.seller.findById({ id: sellerId });
                return new purchaseAction.ConvertExternalToPurchaseSuccess({ screeningEvent, seller });
            } catch (error) {
                return new purchaseAction.ConvertExternalToPurchaseFail({ error: error });
            }
        })
    );
}
