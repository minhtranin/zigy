#ifndef ONNXRUNTIME_COMPAT_H
#define ONNXRUNTIME_COMPAT_H

// Windows compatibility header for ONNX Runtime when using clang/zig
// Defines MSVC SAL (Source Annotation Language) macros that ONNX Runtime uses

// MSVC SAL annotations that ONNX Runtime headers use
// When compiling with clang/zig, these aren't defined, so we stub them out
#ifndef _Frees_ptr_opt_
#define _Frees_ptr_opt_
#endif

#ifndef _In_
#define _In_
#endif

#ifndef _In_opt_
#define _In_opt_
#endif

#ifndef _Out_
#define _Out_
#endif

#ifndef _Out_opt_
#define _Out_opt_
#endif

#ifndef _Inout_
#define _Inout_
#endif

#ifndef _Inout_opt_
#define _Inout_opt_
#endif

#ifndef _Ret_z_
#define _Ret_z_
#endif

#ifndef _Ret_maybenull_
#define _Ret_maybenull_
#endif

#ifndef _Ret_nullnullterminated_
#define _Ret_nullnullterminated_
#endif

#ifndef _In_reads_
#define _In_reads_(size)
#endif

#ifndef _In_reads_bytes_
#define _In_reads_bytes_(size)
#endif

#ifndef _In_reads_opt_
#define _In_reads_opt_(size)
#endif

#ifndef _Out_writes_
#define _Out_writes_(size)
#endif

#ifndef _Out_writes_bytes_
#define _Out_writes_bytes_(size)
#endif

#ifndef _Out_writes_opt_
#define _Out_writes_opt_(size)
#endif

#ifndef _Inout_updates_
#define _Inout_updates_(size)
#endif

#ifndef _Inout_updates_bytes_
#define _Inout_updates_bytes_(size)
#endif

#ifndef _Outptr_
#define _Outptr_
#endif

#ifndef _Outptr_result_maybenull_
#define _Outptr_result_maybenull_
#endif

#ifndef _COM_Outptr_
#define _COM_Outptr_
#endif

#ifndef _Field_size_
#define _Field_size_(size)
#endif

#ifndef _Field_size_bytes_
#define _Field_size_bytes_(size)
#endif

#ifndef _Field_size_opt_
#define _Field_size_opt_(size)
#endif

#ifndef _Field_size_bytes_opt_
#define _Field_size_bytes_opt_(size)
#endif

#ifndef _Printf_format_string_
#define _Printf_format_string_
#endif

#ifndef _Scanf_format_string_
#define _Scanf_format_string_
#endif

#ifndef _Check_return_
#define _Check_return_
#endif

#ifndef _Maybenull_
#define _Maybenull_
#endif

#ifndef _Null_terminated_
#define _Null_terminated_
#endif

// Ensure __cplusplus is defined for C compatibility
#ifdef __cplusplus
extern "C" {
#endif

// Undo any __cplusplus guard that ONNX Runtime might use
#ifdef __cplusplus
}
#endif

#endif // ONNXRUNTIME_COMPAT_H
