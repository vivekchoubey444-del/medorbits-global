package in.medorbits.app;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class PackageIdentityTest {
    @Test public void packageIdentityIsStable() {
        assertEquals("in.medorbits.app", MainActivity.class.getPackage().getName());
    }
}
