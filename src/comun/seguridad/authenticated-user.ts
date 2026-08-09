export interface AuthenticatedUser {
  sub: string;
  usuario: string;
  roles: string[];
  sesionId: string;
  tipo: "acceso";
}
