export interface AuthenticatedUser {
  sub: string;
  usuario: string;
  nombreCompleto: string;
  roles: string[];
  sesionId: string;
}
