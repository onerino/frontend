import { factory } from '@cinerino/api-javascript-client';

export interface ISize {
    w: number;
    h: number;
}

export interface IPosition {
    x: number;
    y: number;
}

export interface IObject extends ISize, IPosition {
    image: string;
}

export interface IScreen {
    type: number;
    size: ISize;
    objects: IObject[];
    seatStart: IPosition;
    map: number[][];
    special: string[];
    hc: string[];
    pair: string[];
    seatSize: ISize;
    seatMargin: ISize;
    aisle: {
        small: ISize;
        middle: ISize;
    };
    seatLabelPos: number;
    seatNumberPos: number;
    seatNumberAlign: 'left' | 'right';
    html: string;
    style?: string;
    columnLabel: boolean;
    lineLabel: boolean;
    codeType: 'chevre' | 'coa';
}

export interface ILabel {
    id: number;
    w: number;
    h: number;
    y: number;
    x: number;
    label: string;
}

export enum SeatStatus {
    Disabled = 'disabled',
    Default = 'default',
    Active = 'active'
}

export interface IRow {
    className: string;
    code: string;
    y: number;
    x: number;
    data: ISeat[];
}

export interface ISeat {
    className: string;
    w: number;
    h: number;
    y: number;
    x: number;
    code: string;
    section: string;
    status: SeatStatus;
    ticketedSeat?: factory.chevre.reservation.ISeat<factory.chevre.reservationType.EventReservation>;
}
