#ifndef WINDOWS_ENDIAN_H
#define WINDOWS_ENDIAN_H

// Windows compatibility for POSIX endian.h
// April ASR uses: le32toh, htole32, be32toh, htobe32

#include <intrin.h>
#include <stdint.h>

// Check if we're little-endian (Windows x86/x64 always is)
#if defined(_MSC_VER)
#define __BYTE_ORDER__ __ORDER_LITTLE_ENDIAN__
#define __ORDER_LITTLE_ENDIAN__ 1234
#define __ORDER_BIG_ENDIAN__ 4321
#endif

// Little-endian conversions (no-op on little-endian systems)
#define le16toh(x) (x)
#define le32toh(x) (x)
#define le64toh(x) (x)
#define htole16(x) (x)
#define htole32(x) (x)
#define htole64(x) (x)

// Big-endian conversions (need byte swap)
static inline uint16_t htobe16(uint16_t x) {
    return _byteswap_ushort(x);
}
static inline uint32_t htobe32(uint32_t x) {
    return _byteswap_ulong(x);
}
static inline uint64_t htobe64(uint64_t x) {
    return _byteswap_uint64(x);
}
static inline uint16_t be16toh(uint16_t x) {
    return _byteswap_ushort(x);
}
static inline uint32_t be32toh(uint32_t x) {
    return _byteswap_ulong(x);
}
static inline uint64_t be64toh(uint64_t x) {
    return _byteswap_uint64(x);
}

#endif // WINDOWS_ENDIAN_H
