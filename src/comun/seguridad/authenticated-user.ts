export interface AuthenticatedUser {
  sub: number;
  usuario: string;
  nombreCompleto: string;
  roles: string[];
  sesionId: number;
}
