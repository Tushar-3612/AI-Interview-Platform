#!/bin/sh
set -e

# Read code from stdin
cat > Solution.java

# Generate Runner based on mode
if [ "$EXECUTION_MODE" = "FUNCTION" ]; then
    cat > Runner.java << 'EOF'
import java.lang.reflect.Method;
import java.util.*;

public class Runner {
    public static void main(String[] args) throws Exception {
        try {
            Scanner sc = new Scanner(System.in);
            String paramTypes = System.getenv("PARAM_TYPES");
            String[] types = paramTypes != null ? paramTypes.split(",") : new String[0];
            
            Object[] params = new Object[types.length];
            for (int i = 0; i < types.length; i++) {
                String type = types[i].trim();
                if (type.equals("int")) {
                    params[i] = sc.hasNextInt() ? sc.nextInt() : 0;
                } else if (type.equals("int[]")) {
                    int n = sc.hasNextInt() ? sc.nextInt() : 0;
                    int[] arr = new int[n];
                    for (int j = 0; j < n && sc.hasNextInt(); j++) {
                        arr[j] = sc.nextInt();
                    }
                    params[i] = arr;
                } else if (type.equals("String")) {
                    params[i] = sc.hasNext() ? sc.next() : "";
                } else if (type.equals("double")) {
                    params[i] = sc.hasNextDouble() ? sc.nextDouble() : 0.0;
                } else {
                    params[i] = sc.hasNext() ? sc.next() : "";
                }
            }
            
            Class<?>[] paramClasses = new Class[types.length];
            for (int i = 0; i < types.length; i++) {
                String type = types[i].trim();
                paramClasses[i] = getClassForType(type);
            }
            
            Method method = Solution.class.getMethod("solve", paramClasses);
            Object result = method.invoke(null, params);
            
            if (result != null) {
                if (result.getClass().isArray()) {
                    if (result instanceof int[]) {
                        System.out.println(Arrays.toString((int[]) result));
                    } else if (result instanceof String[]) {
                        System.out.println(Arrays.toString((String[]) result));
                    } else {
                        System.out.println(Arrays.toString((Object[]) result));
                    }
                } else {
                    System.out.println(result);
                }
            }
        } catch (NoSuchMethodException e) {
            System.err.println("METHOD_NOT_FOUND: " + e.getMessage());
            System.exit(1);
        } catch (Exception e) {
            System.err.println("RUNTIME_ERROR: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    private static Class<?> getClassForType(String type) {
        switch (type.trim()) {
            case "int": return int.class;
            case "int[]": return int[].class;
            case "String": return String.class;
            case "String[]": return String[].class;
            case "double": return double.class;
            case "double[]": return double[].class;
            case "long": return long.class;
            case "long[]": return long[].class;
            case "boolean": return boolean.class;
            case "boolean[]": return boolean[].class;
            default: return Object.class;
        }
    }
}
EOF
else
    cat > Runner.java << 'EOF'
public class Runner {
    public static void main(String[] args) throws Exception {
        try {
            Solution.main(args);
        } catch (Exception e) {
            System.err.println("RUNTIME_ERROR: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
EOF
fi

# Compile
javac -encoding UTF-8 *.java 2> compile_error.txt
if [ $? -ne 0 ]; then
    echo "COMPILATION_ERROR" >&2
    cat compile_error.txt >&2
    exit 1
fi

# Run with timeout (5 seconds)
timeout 5s java Runner 2> runtime_error.txt
exit_code=$?

if [ $exit_code -eq 124 ]; then
    echo "TIME_LIMIT_EXCEEDED" >&2
    exit 124
elif [ -s runtime_error.txt ]; then
    echo "RUNTIME_ERROR" >&2
    cat runtime_error.txt >&2
    exit 1
fi

exit $exit_code