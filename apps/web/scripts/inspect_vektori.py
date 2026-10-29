import inspect
import vektori
print('vektori version:', getattr(vektori, '__version__', 'unknown'))
print('has Vektori class:', hasattr(vektori, 'Vektori'))
if hasattr(vektori, 'Vektori'):
    try:
        print('signature:', inspect.signature(vektori.Vektori))
    except Exception as e:
        print('signature error:', repr(e))
print('module dir sample:', [a for a in dir(vektori) if a[0].islower()][:80])
