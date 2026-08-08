// src/types/api.ts

export interface LoginRequest {
  auth_code: string;
  redirect_uri: string;
  state?: string;
}

export interface PostRequest {
  title: string;
  content: string;
}

export interface PostResponse {
  id: number;
  title: string;
  content: string;
}

export interface ScheduleRequest {
  title: string;
  content: string;
  grade: number;
  classNum: number;
  endDate: string; // ISO String (예: "2026-08-04T18:00:00")
}

export interface ScheduleResponse {
  id: string; // UUID String
  title: string;
  content: string;
  grade: number;
  classNum: number;
  endDate: string;
}