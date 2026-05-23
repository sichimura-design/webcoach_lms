export interface LoginCredentials {
  username: string;
  password: string;
  service?: string;
}

export interface AuthResponse {
  token: string;
  privatetoken?: string;
}

export interface User {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  fullname: string;
}

export interface ApiError {
  exception: string;
  errorcode: string;
  message: string;
}