declare module 'open-location-code' {
  export class OpenLocationCode {
    encode(
      latitude: number | string,
      longitude: number | string,
      codeLength?: number,
    ): string;
    decode(code: string): {
      latitudeCenter: number;
      longitudeCenter: number;
    };
  }
}
