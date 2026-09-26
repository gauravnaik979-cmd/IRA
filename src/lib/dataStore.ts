import { Student, Attendance, LeaveRequest, Room, Hostel, MonthlyBill, Notification, MealRates } from '../types';

export const INITIAL_MEAL_RATES: MealRates = {
  lunchPrice: 35,
  dinnerPrice: 35,
};

export const INITIAL_HOSTELS: Hostel[] = [];

export const INITIAL_ROOMS: Room[] = [];

export const INITIAL_STUDENTS: Student[] = [];

export const generateMockAttendance = (students: Student[]): Attendance[] => {
  return [];
};

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];

export const INITIAL_NOTIFICATIONS: Notification[] = [];

export const generateMockBills = (students: Student[], attendance: Attendance[]): MonthlyBill[] => {
  return [];
};
