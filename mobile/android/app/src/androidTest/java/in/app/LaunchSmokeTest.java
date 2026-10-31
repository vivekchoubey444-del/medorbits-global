package in.medorbits.app;

import static org.junit.Assert.assertNotNull;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ApplicationProvider;
import android.content.Context;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class LaunchSmokeTest {
    @Test public void applicationContextAvailable() {
        Context context = ApplicationProvider.getApplicationContext();
        assertNotNull(context);
    }
}
